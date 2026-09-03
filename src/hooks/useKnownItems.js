import { useState, useEffect } from 'react';
import { db, collection, onSnapshot } from '../services/backend';

const EMPTY = [];

function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Live view of the family's product vocabulary (categoryHistory) — the same data the MCP server
 * exposes as get_known_items. Merged duplicates (docs with an `alias` field) are folded into the
 * item the family keeps, so their spellings still match while typing but never show up as
 * separate suggestions. Returns [{ key, name, categoryId, aliases }] sorted by name.
 */
export function useKnownItems(familyId) {
    const [knownItems, setKnownItems] = useState(EMPTY);

    useEffect(() => {
        if (!familyId) return;
        const unsubscribe = onSnapshot(collection(db, `families/${familyId}/categoryHistory`), (snapshot) => {
            const docs = snapshot.docs.map(d => ({ key: d.id, ...d.data() }));
            const canonical = new Map();
            for (const d of docs) {
                if (d.alias) continue;
                canonical.set(d.key, { key: d.key, name: d.name || capitalize(d.key), categoryId: d.categoryId || null, aliases: [] });
            }
            for (const d of docs) {
                if (d.alias && canonical.has(d.alias)) canonical.get(d.alias).aliases.push(d.name || capitalize(d.key));
            }
            setKnownItems([...canonical.values()].sort((a, b) => a.name.localeCompare(b.name, 'nb')));
        }, (err) => {
            console.error('Error loading known items:', err);
            setKnownItems(EMPTY);
        });
        return unsubscribe;
    }, [familyId]);

    return familyId ? knownItems : EMPTY;
}

/**
 * Ranks known items against what the user has typed so far. Exact name first, then names that
 * start with the text, then names with a word that starts with it ("pap" → "Rød paprika"),
 * then — once two or more letters are typed — anything containing it. Aliases count too, so
 * "cherrytomat" still finds "Cherrytomater". When the only hit is the name typed exactly as
 * stored, nothing is returned — there is nothing left to suggest.
 */
export function matchKnownItems(knownItems, text, max = 6) {
    const q = (text || '').trim().toLowerCase();
    if (!q) return EMPTY;

    const scored = [];
    for (const item of knownItems) {
        let best = null;
        for (const candidate of [item.name, ...item.aliases]) {
            const n = candidate.toLowerCase();
            let score;
            if (n === q) score = 0;
            else if (n.startsWith(q)) score = 1;
            else if (n.split(/\s+/).some(w => w.startsWith(q))) score = 2;
            else if (q.length >= 2 && n.includes(q)) score = 3;
            else continue;
            if (best === null || score < best) best = score;
        }
        if (best !== null) scored.push({ item, score: best });
    }

    scored.sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name, 'nb'));
    if (scored.length === 0) return EMPTY;
    if (scored.length === 1 && scored[0].item.name.toLowerCase() === q) return EMPTY;
    return scored.slice(0, max).map(s => s.item);
}
