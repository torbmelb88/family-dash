// Units that can follow a leading amount, e.g. "2 ss olivenolje", "1 boks hermetiske tomater"
const UNITS = new Set([
    'g', 'gram', 'kg', 'hg', 'mg',
    'l', 'liter', 'dl', 'cl', 'ml',
    'ss', 'ts', 'krm', 'ms',
    'stk', 'stykker', 'pk', 'pakke', 'pakker',
    'boks', 'bokser', 'pose', 'poser', 'glass',
    'fedd', 'båt', 'båter', 'bunt', 'bunter',
    'neve', 'never', 'klype', 'klyper',
    'skive', 'skiver', 'terning', 'terninger',
    'kvast', 'kvaster', 'stilk', 'stilker', 'blad', 'blader',
]);

// Leading amount: "1", "0,5", "1/2", "1 1/2", "2-3", "½", "1½"
const AMOUNT_RE = new RegExp(
    '^(' +
    '\\d+\\s+\\d+\\s*/\\s*\\d+' +                          // 1 1/2
    '|\\d+\\s*/\\s*\\d+' +                                 // 1/2
    '|\\d+(?:[.,]\\d+)?\\s*[-–]\\s*\\d+(?:[.,]\\d+)?' +    // 2-3
    '|\\d+\\s*[½¼¾⅓⅔]' +                                   // 1½
    '|\\d+(?:[.,]\\d+)?' +                                 // 2 / 0,5
    '|[½¼¾⅓⅔⅛]' +                                          // ½
    ')\\s+'
);

function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Splits an ingredient line into a clean shopping list name and quantity info.
 * Handles both amount-first and amount-last formats:
 *   "1 ss smør"                          → name "Smør",        amount "1",   unit "ss"
 *   "100 g soltørkede tomater, hakket"   → name "Soltørkede tomater", note "hakket"
 *   "Smør til steking (usaltet), 4 ss"   → name "Smør til steking",   note "usaltet"
 *   "3 kyllingfileter"                   → name "Kyllingfileter", amount "3"
 * Returns { name, amount, unit, note, quantity } where quantity is the
 * combined display string, e.g. "100 g, hakket".
 */
export function parseIngredientLine(line) {
    let rest = line.trim();
    let amount = '';
    let unit = '';
    let note = '';

    // 1. Leading amount, e.g. "1 ss smør" / "3 kyllingfileter"
    const amountMatch = rest.match(AMOUNT_RE);
    if (amountMatch) {
        amount = amountMatch[1].replace(/\s+/g, ' ').trim();
        rest = rest.slice(amountMatch[0].length);

        const unitMatch = rest.match(/^([^\s.,]+)\.?\s+(.+)$/);
        if (unitMatch && UNITS.has(unitMatch[1].toLowerCase())) {
            unit = unitMatch[1].toLowerCase();
            rest = unitMatch[2];
        }
    } else {
        // 2. Legacy amount-last format: "Smør, 4 ss"
        const lastComma = rest.lastIndexOf(',');
        if (lastComma !== -1) {
            const tail = rest.slice(lastComma + 1).trim();
            if (/\d/.test(tail)) {
                rest = rest.slice(0, lastComma).trim();
                const tailAmount = tail.match(AMOUNT_RE) || tail.match(/^(\d+(?:[.,]\d+)?)$/);
                if (tailAmount) {
                    amount = tailAmount[1].replace(/\s+/g, ' ').trim();
                    const tailRest = tail.slice(tailAmount[0].length).trim();
                    if (UNITS.has(tailRest.toLowerCase())) unit = tailRest.toLowerCase();
                    else if (tailRest) note = tailRest;
                } else {
                    note = tail;
                }
            }
        }
    }

    // 3. Trailing preparation note without digits: "hvitløksfedd, finhakket"
    const noteComma = rest.lastIndexOf(',');
    if (noteComma !== -1) {
        const tail = rest.slice(noteComma + 1).trim();
        if (tail && !/\d/.test(tail)) {
            rest = rest.slice(0, noteComma).trim();
            note = note ? `${tail}, ${note}` : tail;
        }
    }

    // 4. Parenthetical spec, e.g. "Høyrygg av storfe (ternet)"
    const parenMatch = rest.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (parenMatch && parenMatch[1]) {
        rest = parenMatch[1].trim();
        note = note ? `${parenMatch[2].trim()}, ${note}` : parenMatch[2].trim();
    }

    const name = capitalize(rest) || line.trim();
    const amountUnit = [amount, unit].filter(Boolean).join(' ');
    const quantity = [amountUnit, note].filter(Boolean).join(', ');

    return { name, amount, unit, note, quantity };
}

export function parseRecipeText(text) {
    if (!text || !text.trim()) return null;

    const lines = text.split('\n').map(l => l.trim());
    let i = 0;

    // Skip blank lines at the top
    while (i < lines.length && !lines[i]) i++;
    if (i >= lines.length) return null;

    const dish = lines[i++];

    let portions = '';
    let cookTime = '';
    const ingredients = [];      // full original strings (backward compat)
    const parsedIngredients = []; // { name, amount, unit, note, quantity }
    const steps = [];

    // Read metadata lines (Kategori / Porsjoner / Tid)
    while (i < lines.length) {
        const line = lines[i];
        if (!line) { i++; continue; }

        const portionsMatch = line.match(/^Porsjoner\s*:\s*(.+)/i);
        const timeMatch = line.match(/^Tid\s*:\s*(.+)/i);

        if (portionsMatch) { portions = portionsMatch[1].trim(); i++; continue; }
        if (timeMatch) { cookTime = timeMatch[1].trim(); i++; continue; }

        if (/^(Ingredienser|Fremgangsmåte)/i.test(line)) break;
        if (/^Kategori\s*:/i.test(line)) { i++; continue; }
        break;
    }

    // Parse Ingredienser section
    while (i < lines.length && !/^Ingredienser/i.test(lines[i])) i++;
    i++;

    while (i < lines.length) {
        const line = lines[i];
        if (/^Fremgangsmåte/i.test(line)) break;
        if (line) {
            ingredients.push(line);
            parsedIngredients.push(parseIngredientLine(line));
        }
        i++;
    }

    // Parse Fremgangsmåte section
    while (i < lines.length && !/^Fremgangsmåte/i.test(lines[i])) i++;
    i++;

    let currentStep = [];
    while (i < lines.length) {
        const line = lines[i];
        if (line) {
            currentStep.push(line);
        } else if (currentStep.length > 0) {
            steps.push(currentStep.join(' '));
            currentStep = [];
        }
        i++;
    }
    if (currentStep.length > 0) steps.push(currentStep.join(' '));

    return { dish, portions, cookTime, ingredients, parsedIngredients, steps };
}
