/**
 * Splits "Smør til steking (usaltet), 4 ss" into:
 *   name:     "Smør til steking"   (clean shopping list name)
 *   quantity: "4 ss usaltet"       (amount + any parenthetical spec)
 */
export function parseIngredientLine(line) {
    const lastComma = line.lastIndexOf(',');
    const namePart = lastComma === -1 ? line.trim() : line.slice(0, lastComma).trim();
    const amount   = lastComma === -1 ? ''           : line.slice(lastComma + 1).trim();

    // Pull parenthetical out of the name, e.g. "Høyrygg av storfe (ternet)"
    const parenMatch = namePart.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    const name = parenMatch ? parenMatch[1].trim() : namePart;
    const spec = parenMatch ? parenMatch[2].trim() : '';

    // Combine: "500 g ternet"
    const quantity = [amount, spec].filter(Boolean).join(' ');

    return { name, quantity };
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
    const parsedIngredients = []; // { name, quantity }
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
