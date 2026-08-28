import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import { parseIngredientLine, splitDescriptors, capitalize } from './ingredientName.js';

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

// ---------- item name matching against the family's category memory ----------

// Shortest known key that may act as the head of a compound ("løk" in "hvitløk", "mel" in "hvetemel")
const MIN_HEAD_LEN = 3;

// A name starting with one of these words is a distinct product ("Frossen spinat" is not "Spinat"),
// so it only ever matches a known name exactly — never by compound.
const QUALIFIERS = new Set([
    'fersk', 'ferskt', 'ferske', 'frossen', 'frossent', 'frosne', 'tørket', 'tørkede', 'tørr', 'tørt', 'tørre',
    'røkt', 'røkte', 'syltet', 'syltede', 'hermetisk', 'hermetiske', 'marinert', 'marinerte', 'kokt', 'kokte', 'rå',
]);

const NAMING_CONVENTION = 'Naming convention: for produce, meat, fish and dairy the bare name is the fresh product ("Spinat"); prefix deviations ("Frossen spinat", "Hermetiske tomater", "Røkt laks"). For spices and herbs the bare name is the dried product ("Basilikum"); prefix fresh ("Fersk basilikum"). Colour, preservation and state belong in the name when they are different products on the shelf; amount, size and preparation go in note ("stor", "2 ss", "finhakket"). Variants are separate items even in the same category: "Rød paprika", "Gul paprika", "Grønn paprika" and plain "Paprika" (for recipes that do not specify) are four items, and "Kremfløte" and "Matfløte" are two — never collapse them.';

/**
 * Loads categoryHistory — the product names the family actually uses — joined with category names.
 * Entries whose category no longer exists are kept (the name is still the family's vocabulary)
 * but get category null. Docs with an `alias` field are merged duplicates that point to the key
 * the family keeps ("cherrytomat" → "cherrytomater"); they are returned separately.
 */
async function loadKnownItems(familyId) {
    const [historySnap, categoriesSnap] = await Promise.all([
        db.collection(`families/${familyId}/categoryHistory`).get(),
        db.collection(`families/${familyId}/shoppingListCategories`).get(),
    ]);
    const categoryNames = new Map(categoriesSnap.docs.map(c => [c.id, c.get('name')]));
    const docs = historySnap.docs.map(d => ({ key: d.id, data: d.data() }));
    const canonicalKeys = new Set(docs.filter(d => !d.data.alias).map(d => d.key));

    const items = [];
    const aliases = [];
    for (const { key, data } of docs) {
        if (data.alias) {
            // Ignore dangling aliases (target deleted) — they behave like unknown names
            if (canonicalKeys.has(data.alias)) aliases.push({ key, name: data.name || capitalize(key), aliasOf: data.alias });
            continue;
        }
        const categoryId = categoryNames.has(data.categoryId) ? data.categoryId : null;
        items.push({
            key,
            name: data.name || capitalize(key),
            hasStoredName: !!data.name,
            categoryId,
            category: categoryId ? categoryNames.get(categoryId) : null,
            aliases: [],
        });
    }
    for (const a of aliases) items.find(i => i.key === a.aliasOf).aliases.push(a.name);
    return { items, aliases, categoryNames };
}

function historyRef(familyId, key) {
    return db.doc(`families/${familyId}/categoryHistory/${key}`);
}

/**
 * Finds the family's known item for a name. Returns { match, reason }: match is the known item with
 * matchedVia set, or null with reason explaining why no safe match was made.
 * 1. Exact match on the normalized key — always wins, so a category the family set by hand in
 *    the app ("kokosmelk" → Asiatisk) beats any guess below for good.
 * 2. Alias: a merged duplicate resolves to the item the family keeps ("cherrytomat" → "Cherrytomater").
 * 3. Names starting with a qualifier ("frossen spinat") stop here: they are distinct products.
 * 4. Compound match: Norwegian compounds carry the head noun last, so "kremfløte" → "fløte" and
 *    "cherrytomater" → "tomater". Longest known key that ends the name wins; failing that, the
 *    shortest known key that the name ends ("fløte" → "kremfløte"). Refused when other known
 *    variants of the same head sit in a different category — then it is a guess, not a match.
 */
function matchKnownItem(name, known) {
    const { items, aliases } = known;
    const key = normalizeItemName(name);
    if (!key) return { match: null, reason: 'Empty name.' };
    const exact = items.find(i => i.key === key);
    if (exact) return { match: { ...exact, matchedVia: 'exact' } };
    const alias = aliases.find(a => a.key === key);
    if (alias) return { match: { ...items.find(i => i.key === alias.aliasOf), matchedVia: 'alias' } };

    const firstWord = key.split(/\s+/)[0];
    if (QUALIFIERS.has(firstWord)) {
        return { match: null, reason: `"${name}" starts with "${firstWord}", which marks a distinct product; only an exact known name counts. Add it with a categoryId, or use a known name.` };
    }
    if (key.length < MIN_HEAD_LEN) return { match: null, reason: 'No known item with this name.' };

    // Qualified products ("Fersk basilikum") never take part in compound matching either way:
    // the bare name is a different product by convention.
    const unqualified = items.filter(i => !QUALIFIERS.has(i.key.split(/\s+/)[0]));
    const heads = unqualified
        .filter(i => i.key.length >= MIN_HEAD_LEN && key.endsWith(i.key))
        .sort((a, b) => b.key.length - a.key.length);
    if (heads[0]) {
        const head = heads[0];
        const variants = unqualified.filter(i => i.key !== head.key && i.key.endsWith(head.key) && i.categoryId && head.categoryId && i.categoryId !== head.categoryId);
        if (variants.length) {
            return { match: null, reason: `"${name}" could belong with "${head.name}" (${head.category}) or "${variants[0].name}" (${variants[0].category}); give a categoryId or use a known name.` };
        }
        return { match: { ...head, matchedVia: 'compound' } };
    }
    const compounds = unqualified
        .filter(i => i.key.endsWith(key))
        .sort((a, b) => a.key.length - b.key.length);
    if (compounds[0]) {
        // "fløte" when the family has both Kremfløte and Matfløte: different products, ask rather than guess
        if (compounds.length > 1) {
            return { match: null, reason: `"${name}" is ambiguous — the family has ${compounds.slice(0, 4).map(c => c.name).join(', ')}; use one of those names.` };
        }
        return { match: { ...compounds[0], matchedVia: 'compound' } };
    }
    return { match: null, reason: 'No known item with this name.' };
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

/** Ingredients whose parsed name differs from a product the family already uses. */
async function ingredientWarningsFor(familyId, ingredients) {
    const known = await loadKnownItems(familyId);
    const warnings = [];
    for (const line of ingredients) {
        const name = parseIngredientLine(line).name;
        const { match } = matchKnownItem(name, known);
        // Only merged spellings (aliases) are "wrong" names. A compound match ("Rød paprika" → Paprika)
        // is a different product that merely shares the category, so it is not flagged.
        if (match && match.matchedVia === 'alias') warnings.push({ ingredient: name, familyUses: match.name });
    }
    return warnings;
}

function withIngredientHint(result, ingredientWarnings) {
    if (ingredientWarnings.length) {
        result.ingredientWarnings = ingredientWarnings;
        result.hint = 'These ingredient names are merged spellings of products the family already uses; prefer the family name so shopping list items match.';
    }
    return result;
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
        description: `Add a new dinner/recipe to the family dinner archive (middagsarkivet). Ingredients should be one entry per ingredient, in Norwegian, including quantity (e.g. "400 g kyllingfilet"). Call get_known_items first and reuse the family's product names in the ingredient lines — the ingredient names later become shopping list items and must match to sort correctly. ${NAMING_CONVENTION} The response lists ingredients whose name differs from a known family product. If imageUrl is omitted, a matching food photo is fetched automatically from Unsplash.`,
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
        return ok(withIngredientHint({ id: docRef.id, ...dinnerData }, await ingredientWarningsFor(familyId, ingredients)));
    });

    server.registerTool('update_dinner', {
        title: 'Update dinner in archive',
        description: 'Update an existing dinner in the archive. Only the fields given are changed; ingredients and steps replace the whole list when given. Pass null for recipeLink, imageUrl, portions or cookTime to clear that field, or an empty array to remove steps. Use list_dinners to find the dinnerId and the current values. Reuse the family\'s product names from get_known_items in ingredient lines.',
        inputSchema: {
            dinnerId: z.string().describe('Document id from the dinner archive'),
            dish: z.string().optional().describe('New dish name'),
            ingredients: z.array(z.string()).optional().describe('Full replacement list of ingredient lines incl. quantities'),
            recipeLink: z.string().nullable().optional(),
            imageUrl: z.string().nullable().optional(),
            steps: z.array(z.string()).optional().describe('Full replacement list of preparation steps; empty array removes steps'),
            portions: z.number().nullable().optional(),
            cookTime: z.string().nullable().optional().describe('e.g. "45 min"'),
        },
    }, async ({ dinnerId, dish, ingredients, recipeLink, imageUrl, steps, portions, cookTime }) => {
        const familyId = await getFamilyId();
        const dinnerRef = db.doc(`families/${familyId}/dinnerArchive/${dinnerId}`);
        const existing = await dinnerRef.get();
        if (!existing.exists) return fail(`No dinner with id "${dinnerId}" in the archive.`);

        const updates = {};
        if (dish !== undefined) {
            if (!dish.trim()) return fail('dish cannot be empty.');
            updates.dish = dish.trim();
        }
        if (ingredients !== undefined) {
            const cleaned = ingredients.map(i => i.trim()).filter(Boolean);
            if (cleaned.length === 0) return fail('ingredients cannot be empty.');
            updates.ingredients = cleaned;
        }
        if (recipeLink !== undefined) updates.recipeLink = recipeLink || null;
        if (imageUrl !== undefined) updates.imageUrl = imageUrl || null;
        if (steps !== undefined) updates.steps = steps.length > 0 ? steps : FieldValue.delete();
        if (portions !== undefined) updates.portions = portions ?? FieldValue.delete();
        if (cookTime !== undefined) updates.cookTime = cookTime || FieldValue.delete();
        if (Object.keys(updates).length === 0) return fail('Nothing to update — give at least one field.');

        await dinnerRef.update(updates);
        const updated = await dinnerRef.get();
        const { dish: d, ingredients: ing, recipeLink: rl, imageUrl: iu, steps: st, portions: po, cookTime: ct } = updated.data();
        const result = { id: dinnerId, dish: d, ingredients: ing || [], recipeLink: rl || null, imageUrl: iu || null, steps: st || [], portions: po || null, cookTime: ct || null, changed: Object.keys(updates) };
        const warnings = updates.ingredients ? await ingredientWarningsFor(familyId, updates.ingredients) : [];
        return ok(withIngredientHint(result, warnings));
    });

    server.registerTool('delete_dinner', {
        title: 'Delete dinner from archive',
        description: 'Permanently delete a dinner from the archive. Any days on the weekly plans that point to it are cleared too. Confirm with the user before deleting; use list_dinners to find the dinnerId.',
        inputSchema: {
            dinnerId: z.string().describe('Document id from the dinner archive'),
        },
    }, async ({ dinnerId }) => {
        const familyId = await getFamilyId();
        const dinnerRef = db.doc(`families/${familyId}/dinnerArchive/${dinnerId}`);
        const existing = await dinnerRef.get();
        if (!existing.exists) return fail(`No dinner with id "${dinnerId}" in the archive.`);

        const plansSnap = await db.collection(`families/${familyId}/weeklyPlans`).get();
        const batch = db.batch();
        const removedFromPlan = [];
        for (const planDoc of plansSnap.docs) {
            const plan = planDoc.data();
            const clear = {};
            for (const day of DAY_KEYS) {
                if (plan[day]?.dinnerId === dinnerId) {
                    clear[day] = FieldValue.delete();
                    removedFromPlan.push({ week: planDoc.id, day });
                }
            }
            if (Object.keys(clear).length) batch.update(planDoc.ref, clear);
        }
        batch.delete(dinnerRef);
        await batch.commit();
        return ok({ deleted: true, id: dinnerId, dish: existing.get('dish'), removedFromPlan });
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

    server.registerTool('get_known_items', {
        title: 'Get known shopping items',
        description: `The product names this family actually uses on the shopping list, with the category each belongs to and any merged duplicate spellings (aliases). Call this before add_shopping_items or add_dinner and reuse these exact names so items sort into the right category and do not become duplicates. ${NAMING_CONVENTION} If you spot duplicates, offer merge_known_items; for names that break the convention, offer rename_known_item. Optionally filtered by substring.`,
        inputSchema: {
            search: z.string().optional().describe('Case-insensitive substring match on item name'),
        },
    }, async ({ search }) => {
        const familyId = await getFamilyId();
        const { items } = await loadKnownItems(familyId);
        let result = items.map(i => ({ name: i.name, category: i.category, ...(i.aliases.length && { aliases: i.aliases }) }));
        if (search) {
            const s = search.toLowerCase();
            result = result.filter(i => i.name.toLowerCase().includes(s) || (i.aliases || []).some(a => a.toLowerCase().includes(s)));
        }
        result.sort((a, b) => a.name.localeCompare(b.name, 'nb'));
        return ok(result);
    });

    server.registerTool('merge_known_items', {
        title: 'Merge duplicate known items',
        description: 'Clean up duplicates in the family\'s known items: the names in merge become aliases of keep, so from now on both Claude and the app turn "Cherrytomat" into "Cherrytomater" automatically, with the kept item\'s category. Items with the merged names on the shopping lists are renamed (and combined with an existing kept item on the same list). keep may be an existing name or a new spelling. Only merge names that are the same product — "Laks" and "Laksefilet" may be different things; ask the user when unsure.',
        inputSchema: {
            keep: z.string().describe('The name to keep, e.g. "Cherrytomater"'),
            merge: z.array(z.string()).min(1).describe('Names to merge into keep, e.g. ["Cherrytomat"]'),
        },
    }, async ({ keep, merge }) => {
        const familyId = await getFamilyId();
        const known = await loadKnownItems(familyId);
        const keepKey = normalizeItemName(keep);
        if (!keepKey) return fail('keep cannot be empty.');
        const mergeKeys = [...new Set(merge.map(normalizeItemName))].filter(k => k && k !== keepKey);
        if (mergeKeys.length === 0) return fail('Nothing to merge — merge must contain at least one name different from keep.');
        const keepAlias = known.aliases.find(a => a.key === keepKey);
        // keep may be an alias of an item being merged: that reverses the earlier merge, keep becomes the name
        if (keepAlias && !mergeKeys.includes(keepAlias.aliasOf)) {
            const target = known.items.find(i => i.key === keepAlias.aliasOf);
            return fail(`"${keep}" is already merged into "${target.name}". Keep "${target.name}", merge "${target.name}" into "${keep}", or unmerge_known_item first.`);
        }

        const canonical = known.items.find(i => i.key === keepKey);
        const canonicalName = canonical?.hasStoredName ? canonical.name : (keepAlias?.name || keep.trim());
        let categoryId = canonical?.categoryId || null;
        for (const k of mergeKeys) {
            const it = known.items.find(i => i.key === k);
            if (!categoryId && it?.categoryId) categoryId = it.categoryId;
        }

        const batch = db.batch();
        batch.set(historyRef(familyId, keepKey), {
            name: canonicalName,
            ...(categoryId && { categoryId }),
            alias: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        const merged = [];
        for (const k of mergeKeys) {
            const it = known.items.find(i => i.key === k);
            const al = known.aliases.find(a => a.key === k);
            const displayName = it?.name || al?.name || capitalize(k);
            merged.push(displayName);
            batch.set(historyRef(familyId, k), {
                alias: keepKey,
                name: displayName,
                categoryId: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            // Aliases that pointed at a merged item now point at keep
            for (const a of known.aliases.filter(a => a.aliasOf === k && a.key !== keepKey)) {
                batch.set(historyRef(familyId, a.key), { alias: keepKey }, { merge: true });
            }
        }

        // Rename items already on the shopping lists, combining with an existing kept item on the same list
        let renamed = 0;
        let combined = 0;
        const listsSnap = await db.collection(`families/${familyId}/shoppingLists`).get();
        for (const list of listsSnap.docs) {
            const itemsSnap = await list.ref.collection('items').get();
            const docs = itemsSnap.docs.map(d => ({ ref: d.ref, ...d.data() }));
            const kept = docs.filter(d => normalizeItemName(d.name || '') === keepKey);
            for (const d of docs.filter(d => mergeKeys.includes(normalizeItemName(d.name || '')))) {
                const target = kept.find(k => !!k.checked === !!d.checked);
                if (target) {
                    target.quantity = (target.quantity || 1) + (d.quantity || 1);
                    target.note = [target.note, d.note].filter(Boolean).join(', ') || null;
                    batch.update(target.ref, { quantity: target.quantity, note: target.note });
                    batch.delete(d.ref);
                    combined++;
                } else {
                    const update = { name: canonicalName };
                    if (categoryId && !d.categoryId) update.categoryId = categoryId;
                    batch.update(d.ref, update);
                    kept.push({ ...d, ...update });
                    renamed++;
                }
            }
        }
        await batch.commit();

        return ok({
            kept: canonicalName,
            category: categoryId ? known.categoryNames.get(categoryId) : null,
            mergedAsAliases: merged,
            shoppingItemsRenamed: renamed,
            shoppingItemsCombined: combined,
        });
    });

    server.registerTool('rename_known_item', {
        title: 'Rename known item',
        description: 'Rename a known item without leaving the old name behind as an alias — use this to bring names in line with the naming convention (e.g. "Spinat" → "Frossen spinat"). Keeps the category and the item\'s other aliases, and renames the item on all shopping lists. The new name may be one of the item\'s own aliases (that alias becomes the name and the old name disappears). Fails if the new name is already another item — use merge_known_items for that.',
        inputSchema: {
            from: z.string().describe('Current name'),
            to: z.string().describe('New name'),
        },
    }, async ({ from, to }) => {
        const familyId = await getFamilyId();
        const known = await loadKnownItems(familyId);
        const fromKey = normalizeItemName(from);
        const toKey = normalizeItemName(to);
        const newName = to.trim();
        if (!fromKey || !toKey) return fail('from and to cannot be empty.');
        const item = known.items.find(i => i.key === fromKey);
        if (!item) {
            const al = known.aliases.find(a => a.key === fromKey);
            if (al) return fail(`"${from}" is an alias of "${known.items.find(i => i.key === al.aliasOf).name}". Rename that item, or unmerge_known_item first.`);
            return fail(`No known item "${from}".`);
        }

        const batch = db.batch();
        if (toKey === fromKey) {
            batch.set(historyRef(familyId, fromKey), { name: newName, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        } else {
            if (known.items.some(i => i.key === toKey)) return fail(`"${to}" already exists. Use merge_known_items to combine the two.`);
            const toAlias = known.aliases.find(a => a.key === toKey);
            if (toAlias && toAlias.aliasOf !== fromKey) return fail(`"${to}" is an alias of "${known.items.find(i => i.key === toAlias.aliasOf).name}". Delete or unmerge it first.`);
            // Plain set (no merge) so an alias doc being promoted loses its alias field
            batch.set(historyRef(familyId, toKey), {
                name: newName,
                ...(item.categoryId && { categoryId: item.categoryId }),
                updatedAt: FieldValue.serverTimestamp(),
            });
            batch.delete(historyRef(familyId, fromKey));
            for (const a of known.aliases.filter(a => a.aliasOf === fromKey && a.key !== toKey)) {
                batch.set(historyRef(familyId, a.key), { alias: toKey }, { merge: true });
            }
        }

        let renamed = 0;
        const listsSnap = await db.collection(`families/${familyId}/shoppingLists`).get();
        for (const list of listsSnap.docs) {
            const itemsSnap = await list.ref.collection('items').get();
            for (const d of itemsSnap.docs) {
                if (normalizeItemName(d.get('name') || '') === fromKey) {
                    batch.update(d.ref, { name: newName });
                    renamed++;
                }
            }
        }
        await batch.commit();
        const aliases = item.aliases.filter(n => normalizeItemName(n) !== toKey);
        return ok({ from: item.name, to: newName, category: item.category, aliases, shoppingItemsRenamed: renamed });
    });

    server.registerTool('unmerge_known_item', {
        title: 'Unmerge alias into its own item',
        description: 'Detach one alias from a known item so it becomes a known item of its own again (e.g. make "Fersk ingefær" separate from "Ingefær"). It gets the given categoryId, or inherits the category of the item it was merged into. Shopping lists are not changed. To simply drop an alias so the name is free, use delete_known_items with the alias name instead.',
        inputSchema: {
            name: z.string().describe('The known item the alias currently belongs to'),
            alias: z.string().describe('The alias to detach'),
            categoryId: z.string().optional().describe('Category for the detached item; defaults to the category of name'),
        },
    }, async ({ name, alias, categoryId }) => {
        const familyId = await getFamilyId();
        const known = await loadKnownItems(familyId);
        const item = known.items.find(i => i.key === normalizeItemName(name));
        if (!item) return fail(`No known item "${name}".`);
        const al = known.aliases.find(a => a.key === normalizeItemName(alias) && a.aliasOf === item.key);
        if (!al) return fail(`"${alias}" is not an alias of "${item.name}". Aliases: ${item.aliases.join(', ') || '(none)'}.`);
        if (categoryId && !known.categoryNames.has(categoryId)) return fail(`Unknown categoryId "${categoryId}".`);
        const catId = categoryId || item.categoryId || null;
        // Plain set (no merge) drops the alias field
        await historyRef(familyId, al.key).set({
            name: al.name,
            ...(catId && { categoryId: catId }),
            updatedAt: FieldValue.serverTimestamp(),
        });
        return ok({ name: al.name, category: catId ? known.categoryNames.get(catId) : null, detachedFrom: item.name });
    });

    server.registerTool('delete_known_items', {
        title: 'Delete known items',
        description: 'Remove names from the family\'s known items (the category memory) — use it for misspellings, junk or one-off entries that would otherwise keep resurfacing as suggestions ("Kyllngfilet"). Deleting a name also drops the aliases merged into it. Does not touch the shopping lists themselves; use remove_shopping_items for that. Confirm with the user first.',
        inputSchema: {
            names: z.array(z.string()).min(1),
        },
    }, async ({ names }) => {
        const familyId = await getFamilyId();
        const known = await loadKnownItems(familyId);
        const batch = db.batch();
        const deleted = [];
        const notFound = [];
        for (const name of names) {
            const key = normalizeItemName(name);
            const item = known.items.find(i => i.key === key);
            const alias = known.aliases.find(a => a.key === key);
            if (!item && !alias) { notFound.push(name); continue; }
            batch.delete(historyRef(familyId, key));
            deleted.push(item?.name || alias.name);
            if (item) {
                for (const a of known.aliases.filter(a => a.aliasOf === key)) {
                    batch.delete(historyRef(familyId, a.key));
                    deleted.push(a.name);
                }
            }
        }
        await batch.commit();
        return ok({ deleted, ...(notFound.length && { notFound }) });
    });

    server.registerTool('add_shopping_items', {
        title: 'Add items to shopping list',
        description: `Add one or more items to a shopping list (defaults to the default list). Item names in Norwegian. Use the bare product name as name ("Smør", not "1 ss smør"); put amounts/units in note. Call get_known_items first and reuse the family's exact names ("Cherrytomater", not "cherrytomat") — names are the key to the family's category memory, so a new spelling lands without a category. ${NAMING_CONVENTION} If categoryId is omitted, each item is placed by history: exact name or alias first; otherwise a compound name borrows the category of its base item ("Rød paprika" from "Paprika", reported as categoryFrom — the item keeps its own name) unless the name starts with a qualifier like "frossen"/"fersk". Items that still have no category are returned in unmatched with a reason; an ambiguous bare name ("fløte" when the family has Kremfløte and Matfløte) is one of them — ask the user which. Use get_shopping_lists to see valid categoryIds.`,
        inputSchema: {
            items: z.array(z.object({
                name: z.string().describe('Bare item name in Norwegian without amounts or size words, e.g. "Løk" (not "1 stor løk" — put "stor" in note)'),
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
        const known = await loadKnownItems(familyId);
        const { categoryNames } = known;

        const batch = db.batch();
        const added = [];
        const unmatched = [];
        for (const item of items) {
            let name = item.name.trim();
            let note = item.note || null;
            // "Stor løk" is Løk with a size note, not a separate product
            const split = splitDescriptors(name);
            if (split.descriptor) {
                name = split.name;
                note = [split.descriptor, note].filter(Boolean).join(', ');
            }
            const { match, reason } = matchKnownItem(name, known);
            const isSameProduct = match && (match.matchedVia === 'exact' || match.matchedVia === 'alias');
            // Use the family's own spelling for a known product ("cherrytomat" → "Cherrytomater")
            let renamedFrom = null;
            if (isSameProduct && match.name !== name) {
                if (match.matchedVia === 'alias') renamedFrom = name;
                name = match.name;
            }
            const key = isSameProduct ? match.key : normalizeItemName(name);
            let categoryId = categoryNames.has(item.categoryId) ? item.categoryId : null;
            let categoryFrom = null;
            if (!categoryId && match?.categoryId) {
                categoryId = match.categoryId;
                if (!isSameProduct) categoryFrom = match.name;
            }

            const docRef = itemsRef.doc();
            batch.set(docRef, {
                name,
                checked: false,
                categoryId,
                quantity: item.quantity || 1,
                note,
            });

            // Teach the category memory, like the app does. Keep the family's stored display name.
            if (categoryId && key) {
                const history = { categoryId, updatedAt: FieldValue.serverTimestamp() };
                if (!(isSameProduct && match.hasStoredName)) history.name = name;
                batch.set(historyRef(familyId, key), history, { merge: true });
            }

            const entry = { id: docRef.id, name, quantity: item.quantity || 1, note, categoryId, category: categoryNames.get(categoryId) || null };
            if (categoryFrom) entry.categoryFrom = categoryFrom;
            if (renamedFrom) entry.renamedFrom = renamedFrom;
            added.push(entry);
            if (!categoryId) unmatched.push({ name, reason });
        }
        await batch.commit();

        const result = { listId: resolvedListId, added };
        if (unmatched.length) {
            result.unmatched = {
                items: unmatched,
                hint: 'These were added without a category. Check get_known_items for the name the family uses, or pass a categoryId from get_shopping_lists.',
            };
        }
        return ok(result);
    });

    server.registerTool('remove_shopping_items', {
        title: 'Remove items from shopping list',
        description: 'Remove items from a shopping list (defaults to the default list) by id (from get_shopping_items) or by name (case-insensitive, merged spellings resolve to the kept name). Set clearChecked to remove every checked-off item instead. Removes all matching items; nothing is deleted for names that are not on the list — they are returned in notFound.',
        inputSchema: {
            itemIds: z.array(z.string()).optional().describe('Item ids from get_shopping_items'),
            names: z.array(z.string()).optional().describe('Item names, e.g. ["Melk", "Løk"]'),
            clearChecked: z.boolean().optional().describe('Remove all checked-off items on the list'),
            listId: z.string().optional().describe('Shopping list id; omit for the default list'),
        },
    }, async ({ itemIds = [], names = [], clearChecked = false, listId }) => {
        if (itemIds.length === 0 && names.length === 0 && !clearChecked) return fail('Give itemIds, names, or clearChecked: true.');
        const familyId = await getFamilyId();
        const resolvedListId = await resolveListId(familyId, listId);
        const itemsSnap = await db.collection(`families/${familyId}/shoppingLists/${resolvedListId}/items`).get();
        const docs = itemsSnap.docs.map(d => ({ ref: d.ref, id: d.id, ...d.data() }));

        // Names resolve through the family's known items so "cherrytomat" finds "Cherrytomater"
        const known = names.length ? await loadKnownItems(familyId) : null;
        const wantedKeys = new Set();
        const notFound = [];
        for (const name of names) {
            const { match } = matchKnownItem(name, known);
            const key = match && (match.matchedVia === 'exact' || match.matchedVia === 'alias') ? match.key : normalizeItemName(name);
            if (docs.some(d => normalizeItemName(d.name || '') === key)) wantedKeys.add(key);
            else notFound.push(name);
        }
        for (const id of itemIds) if (!docs.some(d => d.id === id)) notFound.push(id);

        const toRemove = docs.filter(d =>
            itemIds.includes(d.id) ||
            wantedKeys.has(normalizeItemName(d.name || '')) ||
            (clearChecked && !!d.checked)
        );
        const batch = db.batch();
        for (const d of toRemove) batch.delete(d.ref);
        await batch.commit();

        return ok({
            listId: resolvedListId,
            removed: toRemove.map(d => ({ id: d.id, name: d.name, quantity: d.quantity || 1, checked: !!d.checked })),
            ...(notFound.length && { notFound }),
        });
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
