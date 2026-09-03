import { useState } from 'react';

/**
 * Keyboard handling for a suggestion dropdown attached to a text field.
 * `query` is the text the suggestions were computed from; the list stays hidden after
 * dismiss(query) until the query changes again, so a picked suggestion does not immediately
 * re-open the list. Arrow keys move, Enter picks the highlighted item (only when one is
 * highlighted, so a plain Enter still submits/adds a newline), Escape closes.
 * The highlight is tied to the suggestion array it was set for, so it resets to "none"
 * whenever a new (memoized) suggestion list comes in.
 */
export function useSuggestionNavigation(suggestions, query, onSelect) {
    const [active, setActive] = useState({ list: null, index: -1 });
    const [dismissedFor, setDismissedFor] = useState(null);

    const activeIndex = active.list === suggestions ? active.index : -1;
    const setActiveIndex = (index) => setActive({ list: suggestions, index });
    const visible = suggestions.length > 0 && dismissedFor !== query;

    function handleKeyDown(e) {
        if (!visible) return false;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((activeIndex + 1) % suggestions.length);
            return true;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1);
            return true;
        }
        if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < suggestions.length) {
            e.preventDefault();
            onSelect(suggestions[activeIndex]);
            return true;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            setDismissedFor(query);
            return true;
        }
        return false;
    }

    return {
        activeIndex,
        setActiveIndex,
        visible,
        handleKeyDown,
        dismiss: (forQuery = query) => setDismissedFor(forQuery),
        reset: () => setDismissedFor(null),
    };
}
