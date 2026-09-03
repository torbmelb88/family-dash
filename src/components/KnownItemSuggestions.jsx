/**
 * Dropdown of known items rendered under a text field. The parent must be `relative`.
 * Uses onMouseDown preventDefault so clicking a suggestion does not blur the field first.
 * Keyboard navigation lives in hooks/useSuggestionNavigation.
 */
export default function KnownItemSuggestions({ suggestions, activeIndex, onSelect, onHover, categories = [] }) {
    if (!suggestions || suggestions.length === 0) return null;
    const categoryName = (id) => (id ? categories.find(c => c.id === id)?.name : null);

    return (
        <ul
            role="listbox"
            className="absolute left-0 right-0 top-full mt-1 z-20 bg-surface border border-white/10 rounded-xl shadow-2xl overflow-hidden"
        >
            {suggestions.map((item, i) => {
                const cat = categoryName(item.categoryId);
                return (
                    <li
                        key={item.key}
                        role="option"
                        aria-selected={i === activeIndex}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => onHover && onHover(i)}
                        onClick={() => onSelect(item)}
                        className={`flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors ${i === activeIndex ? 'bg-primary/20 text-white' : 'text-gray-200 hover:bg-white/5'
                            }`}
                    >
                        <span className="truncate">{item.name}</span>
                        {cat && <span className="text-xs text-gray-500 flex-shrink-0">{cat}</span>}
                    </li>
                );
            })}
        </ul>
    );
}
