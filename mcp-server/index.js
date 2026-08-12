import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';

initializeApp();
const db = getFirestore();

// ---------- familyId resolution ----------

let cachedFamilyId = process.env.FAMILY_ID || null;

async function getFamilyId() {
    if (cachedFamilyId) return cachedFamilyId;
    if (process.env.OWNER_UID) {
        const userDoc = await db.doc(`users/${process.env.OWNER_UID}`).get();
        const familyId = userDoc.get('familyId');
        if (!familyId) throw new Error(`users/${process.env.OWNER_UID} has no familyId.`);
        cachedFamilyId = familyId;
        return cachedFamilyId;
    }
    const snap = await db.collection('families').limit(2).get();
    if (snap.empty) throw new Error('No family found in Firestore.');
    if (snap.size > 1) throw new Error('Multiple families found — set FAMILY_ID or OWNER_UID env var to disambiguate.');
    cachedFamilyId = snap.docs[0].id;
    return cachedFamilyId;
}

// ---------- week/date helpers (mirrors src/utils/dateUtils.js) ----------

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function parseDate(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new Error(`Invalid date "${dateStr}" — use YYYY-MM-DD.`);
    const d = new Date(`${dateStr}T12:00:00Z`);
    if (isNaN(d)) throw new Error(`Invalid date "${dateStr}".`);
    return d;
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    d.setUTCDate(diff);
    return d;
}

function getWeekDocId(date) {
    const startOfWeek = getStartOfWeek(date);
    return `${startOfWeek.getUTCFullYear()}-${String(getWeekNumber(startOfWeek)).padStart(2, '0')}`;
}

function normalizeItemName(name) {
    return name.trim().toLowerCase().replace(/[#.$/[\]]/g, '');
}

// ---------- tool helpers ----------

function ok(data) {
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function fail(message) {
    return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

// ---------- Unsplash image lookup (mirrors src/services/unsplash.js) ----------

async function translateToEnglish(text) {
    try {
        const res = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=no|en`
        );
        if (!res.ok) return text;
        const data = await res.json();
        return data.responseData?.translatedText || text;
    } catch {
        return text;
    }
}

async function fetchDinnerImage(dishName) {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!dishName || !accessKey) return null;
    try {
        const englishName = await translateToEnglish(dishName);
        const query = encodeURIComponent(`${englishName} food`);
        const url = `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape&client_id=${accessKey}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return data.results?.[0]?.urls?.regular || null;
    } catch (err) {
        console.error('Unsplash lookup failed:', err);
        return null;
    }
}

async function resolveListId(familyId, listId) {
    if (listId) return listId;
    const familyDoc = await db.doc(`families/${familyId}`).get();
    if (familyDoc.get('defaultShoppingListId')) return familyDoc.get('defaultShoppingListId');
    const lists = await db.collection(`families/${familyId}/shoppingLists`).limit(1).get();
    if (lists.empty) throw new Error('No shopping lists exist.');
    return lists.docs[0].id;
}

// ---------- MCP server ----------

function buildServer() {
    const server = new McpServer({ name: 'family-dash', version: '1.0.0' });

    server.registerTool('list_dinners', {
        title: 'List dinners',
        description: 'List dinners in the family dinner archive (middagsarkivet), optionally filtered by a search term. Returns id, dish name, ingredients, recipe link, portions and cook time.',
        inputSchema: {
            search: z.string().optional().describe('Case-insensitive substring match on dish name'),
        },
    }, async ({ search }) => {
        const familyId = await getFamilyId();
        const snap = await db.collection(`families/${familyId}/dinnerArchive`).get();
        let dinners = snap.docs.map(d => {
            const { dish, ingredients, recipeLink, portions, cookTime } = d.data();
            return { id: d.id, dish, ingredients: ingredients || [], recipeLink: recipeLink || null, portions: portions || null, cookTime: cookTime || null };
        });
        if (search) dinners = dinners.filter(d => (d.dish || '').toLowerCase().includes(search.toLowerCase()));
        return ok(dinners);
    });

    server.registerTool('add_dinner', {
        title: 'Add dinner to archive',
        description: 'Add a new dinner/recipe to the family dinner archive (middagsarkivet). Ingredients should be one entry per ingredient, in Norwegian, including quantity (e.g. "400 g kyllingfilet"). If imageUrl is omitted, a matching food photo is fetched automatically from Unsplash.',
        inputSchema: {
            dish: z.string().describe('Dish name in Norwegian, e.g. "Kylling tikka masala"'),
            ingredients: z.array(z.string()).describe('Ingredient lines incl. quantities'),
            recipeLink: z.string().optional().describe('URL to the recipe, if any'),
            imageUrl: z.string().optional().describe('URL to an image of the dish'),
            steps: z.array(z.string()).optional().describe('Preparation steps'),
            portions: z.number().optional(),
            cookTime: z.string().optional().describe('e.g. "45 min"'),
        },
    }, async ({ dish, ingredients, recipeLink, imageUrl, steps, portions, cookTime }) => {
        const familyId = await getFamilyId();
        const resolvedImageUrl = imageUrl || await fetchDinnerImage(dish);
        const dinnerData = {
            dish,
            ingredients,
            recipeLink: recipeLink || null,
            imageUrl: resolvedImageUrl || null,
            ...(steps && steps.length > 0 && { steps }),
            ...(portions && { portions }),
            ...(cookTime && { cookTime }),
        };
        const docRef = await db.collection(`families/${familyId}/dinnerArchive`).add(dinnerData);
        return ok({ id: docRef.id, ...dinnerData });
    });

    server.registerTool('get_week_plan', {
        title: 'Get weekly dinner plan',
        description: 'Get the planned dinners for the week containing the given date (defaults to the current week). Returns the dinner planned for each weekday, with dish names resolved.',
        inputSchema: {
            date: z.string().optional().describe('Any date in the week, YYYY-MM-DD. Defaults to today.'),
        },
    }, async ({ date }) => {
        const familyId = await getFamilyId();
        const d = date ? parseDate(date) : new Date();
        const weekDocId = getWeekDocId(d);
        const weekDoc = await db.doc(`families/${familyId}/weeklyPlans/${weekDocId}`).get();
        const plan = weekDoc.exists ? weekDoc.data() : {};

        const monday = getStartOfWeek(d);
        const days = {};
        for (const [i, key] of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].entries()) {
            const dayDate = new Date(monday);
            dayDate.setUTCDate(monday.getUTCDate() + i);
            const entry = plan[key];
            let dish = null;
            if (entry?.dinnerId) {
                const dinnerDoc = await db.doc(`families/${familyId}/dinnerArchive/${entry.dinnerId}`).get();
                dish = dinnerDoc.exists ? dinnerDoc.get('dish') : '(deleted dinner)';
            }
            days[key] = { date: dayDate.toISOString().slice(0, 10), dinnerId: entry?.dinnerId || null, dish };
        }
        return ok({ week: weekDocId, days });
    });

    server.registerTool('plan_dinner', {
        title: 'Plan dinner for a day',
        description: 'Put a dinner from the archive on the weekly plan for a specific date. Use list_dinners (or the id returned by add_dinner) to find the dinnerId.',
        inputSchema: {
            date: z.string().describe('The day to plan the dinner for, YYYY-MM-DD'),
            dinnerId: z.string().describe('Document id from the dinner archive'),
        },
    }, async ({ date, dinnerId }) => {
        const familyId = await getFamilyId();
        const dinnerDoc = await db.doc(`families/${familyId}/dinnerArchive/${dinnerId}`).get();
        if (!dinnerDoc.exists) return fail(`No dinner with id "${dinnerId}" in the archive.`);
        const d = parseDate(date);
        const weekDocId = getWeekDocId(d);
        const dayKey = DAY_KEYS[d.getUTCDay()];
        await db.doc(`families/${familyId}/weeklyPlans/${weekDocId}`).set({ [dayKey]: { dinnerId } }, { merge: true });
        return ok({ planned: dinnerDoc.get('dish'), date, week: weekDocId, day: dayKey });
    });

    server.registerTool('remove_planned_dinner', {
        title: 'Remove planned dinner',
        description: 'Remove the planned dinner from a specific date on the weekly plan.',
        inputSchema: {
            date: z.string().describe('YYYY-MM-DD'),
        },
    }, async ({ date }) => {
        const familyId = await getFamilyId();
        const d = parseDate(date);
        const weekDocId = getWeekDocId(d);
        const dayKey = DAY_KEYS[d.getUTCDay()];
        await db.doc(`families/${familyId}/weeklyPlans/${weekDocId}`).set({ [dayKey]: FieldValue.delete() }, { merge: true });
        return ok({ removed: true, date, day: dayKey });
    });

    server.registerTool('get_shopping_lists', {
        title: 'Get shopping lists',
        description: 'List the family shopping lists (handlelister) with their ids and available categories. Marks which list is the default.',
        inputSchema: {},
    }, async () => {
        const familyId = await getFamilyId();
        const [familyDoc, listsSnap, categoriesSnap] = await Promise.all([
            db.doc(`families/${familyId}`).get(),
            db.collection(`families/${familyId}/shoppingLists`).get(),
            db.collection(`families/${familyId}/shoppingListCategories`).get(),
        ]);
        const defaultListId = familyDoc.get('defaultShoppingListId') || null;
        const categories = categoriesSnap.docs.map(c => ({ id: c.id, name: c.get('name'), listId: c.get('listId') || null }));
        const lists = listsSnap.docs.map(l => ({
            id: l.id,
            name: l.get('name'),
            isDefault: l.id === defaultListId,
            categories: categories.filter(c => c.listId === l.id || c.listId === null),
        }));
        return ok(lists);
    });

    server.registerTool('get_shopping_items', {
        title: 'Get shopping list items',
        description: 'Get the items on a shopping list (defaults to the default list), including checked state and category.',
        inputSchema: {
            listId: z.string().optional().describe('Shopping list id; omit for the default list'),
        },
    }, async ({ listId }) => {
        const familyId = await getFamilyId();
        const resolvedListId = await resolveListId(familyId, listId);
        const [itemsSnap, categoriesSnap] = await Promise.all([
            db.collection(`families/${familyId}/shoppingLists/${resolvedListId}/items`).get(),
            db.collection(`families/${familyId}/shoppingListCategories`).get(),
        ]);
        const categoryNames = new Map(categoriesSnap.docs.map(c => [c.id, c.get('name')]));
        const items = itemsSnap.docs.map(i => ({
            id: i.id,
            name: i.get('name'),
            quantity: i.get('quantity') || 1,
            note: i.get('note') || null,
            checked: !!i.get('checked'),
            category: categoryNames.get(i.get('categoryId')) || null,
        }));
        return ok({ listId: resolvedListId, items });
    });

    server.registerTool('add_shopping_items', {
        title: 'Add items to shopping list',
        description: 'Add one or more items to a shopping list (defaults to the default list). Item names in Norwegian. Use the bare product name as name ("Smør", not "1 ss smør") so the same product matches across recipes; put amounts/units in note instead. If categoryId is omitted, the family\'s category history is used to place each item in the category it usually gets ("melk" goes where melk went last time). Use get_shopping_lists to see valid categoryIds.',
        inputSchema: {
            items: z.array(z.object({
                name: z.string().describe('Bare item name in Norwegian without amounts, e.g. "Melk"'),
                quantity: z.number().optional().describe('Defaults to 1'),
                note: z.string().optional().describe('Amount/unit or other info shown as secondary text, e.g. "1 ss" or "400 g"'),
                categoryId: z.string().optional().describe('Category id; omit to auto-resolve from history'),
            })).min(1),
            listId: z.string().optional().describe('Shopping list id; omit for the default list'),
        },
    }, async ({ items, listId }) => {
        const familyId = await getFamilyId();
        const resolvedListId = await resolveListId(familyId, listId);
        const itemsRef = db.collection(`families/${familyId}/shoppingLists/${resolvedListId}/items`);

        const batch = db.batch();
        const added = [];
        for (const item of items) {
            let categoryId = item.categoryId || null;
            if (!categoryId) {
                const normalized = normalizeItemName(item.name);
                if (normalized) {
                    const historyDoc = await db.doc(`families/${familyId}/categoryHistory/${normalized}`).get();
                    if (historyDoc.exists) categoryId = historyDoc.get('categoryId') || null;
                }
            }
            const docRef = itemsRef.doc();
            batch.set(docRef, {
                name: item.name,
                checked: false,
                categoryId,
                quantity: item.quantity || 1,
                note: item.note || null,
            });
            added.push({ id: docRef.id, name: item.name, quantity: item.quantity || 1, note: item.note || null, categoryId });
        }
        await batch.commit();
        return ok({ listId: resolvedListId, added });
    });

    return server;
}

// ---------- HTTP handler ----------

function timingSafeMatch(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function isAuthorized(req) {
    const secret = process.env.MCP_SECRET;
    if (!secret || secret === 'change-me') return false;

    const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (timingSafeMatch(bearer, secret)) return true;
    const headerKey = req.get('x-api-key') || req.get('x-auth-token') || '';
    if (timingSafeMatch(headerKey, secret)) return true;

    return (req.path || '').split('/').some(segment => timingSafeMatch(segment, secret));
}

export const mcp = onRequest({
    region: 'europe-west1',
    invoker: 'public',
    maxInstances: 3,
    memory: '256MiB',
}, async (req, res) => {
    if (!isAuthorized(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Method not allowed. This server runs in stateless mode; use POST.' },
            id: null,
        });
        return;
    }

    try {
        const server = buildServer();
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
        });
        res.on('close', () => {
            transport.close();
            server.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    } catch (err) {
        console.error('MCP request failed:', err);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: { code: -32603, message: 'Internal server error' },
                id: null,
            });
        }
    }
});
