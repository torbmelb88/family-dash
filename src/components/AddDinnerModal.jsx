import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Search, Plus, ChefHat, ClipboardPaste, Clock, Users, ListOrdered, ImageIcon, RefreshCw, Loader2 } from 'lucide-react';
import { db, collection, addDoc } from '../services/backend';
import { updateDinnerInArchive } from '../services/api';
import { parseRecipeText, splitLeadingAmount, splitDescriptors } from '../utils/recipeParser';
import { useKnownItems, matchKnownItems } from '../hooks/useKnownItems';
import { useSuggestionNavigation } from '../hooks/useSuggestionNavigation';
import KnownItemSuggestions from '../components/KnownItemSuggestions';
import { fetchDinnerImages } from '../services/unsplash';
import { useTranslation } from 'react-i18next';

/**
 * Splits an ingredient line being typed into the part to keep ("1 stor ") and the product name
 * to look up ("l" → "Løk"). Amount, unit and size words stay in the prefix.
 */
function splitIngredientLine(line) {
    const leading = splitLeadingAmount(line);
    let prefix = leading.prefix;
    let rest = leading.rest;
    const split = splitDescriptors(rest);
    if (split.descriptor) {
        const idx = rest.lastIndexOf(split.name);
        if (idx > 0) {
            prefix += rest.slice(0, idx);
            rest = rest.slice(idx);
        }
    }
    return { prefix, rest };
}

export default function AddDinnerModal({ isOpen, onClose, onSelectDinner, familyId, dinnerArchive, dinnerToEdit }) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(dinnerToEdit ? 'new' : 'archive');
    const [searchTerm, setSearchTerm] = useState('');

    // New dinner form state
    const [newDish, setNewDish] = useState('');
    const [newIngredients, setNewIngredients] = useState('');
    const [newRecipeLink, setNewRecipeLink] = useState('');
    const [newImageUrl, setNewImageUrl] = useState('');
    const [loading, setLoading] = useState(false);

    // Image picker state (shared between tabs)
    const [imageOptions, setImageOptions] = useState([]);
    const [imageIndex, setImageIndex] = useState(0);
    const [imageFetching, setImageFetching] = useState(false);
    const debounceRef = useRef(null);

    // Paste tab state
    const [pasteText, setPasteText] = useState('');
    const [parsed, setParsed] = useState(null);

    // Ingredient suggestions: match the product name on the line under the cursor against
    // the family's known items, keeping any leading amount and size word ("1 stor ") as typed.
    const ingredientsRef = useRef(null);
    const [ingredientCursor, setIngredientCursor] = useState(0);
    const [pendingCursor, setPendingCursor] = useState(null);
    const knownItems = useKnownItems(isOpen ? familyId : null);
    const currentLine = useMemo(() => {
        const pos = Math.min(ingredientCursor, newIngredients.length);
        const start = newIngredients.lastIndexOf('\n', pos - 1) + 1;
        const newlineAfter = newIngredients.indexOf('\n', pos);
        const end = newlineAfter === -1 ? newIngredients.length : newlineAfter;
        const { prefix, rest } = splitIngredientLine(newIngredients.slice(start, end));
        return { start, end, prefix, rest };
    }, [newIngredients, ingredientCursor]);
    const ingredientSuggestions = useMemo(() => matchKnownItems(knownItems, currentLine.rest), [knownItems, currentLine.rest]);
    const ingredientNav = useSuggestionNavigation(ingredientSuggestions, currentLine.rest, selectIngredientSuggestion);

    function selectIngredientSuggestion(item) {
        // After an amount the name reads better in lower case ("400 g kyllingfilet"); keep names
        // that are capitalised beyond the first letter (brands, acronyms) as they are.
        const name = currentLine.prefix && !/^.[A-ZÆØÅ]/.test(item.name)
            ? item.name.charAt(0).toLowerCase() + item.name.slice(1)
            : item.name;
        const newLine = currentLine.prefix + name;
        setNewIngredients(newIngredients.slice(0, currentLine.start) + newLine + newIngredients.slice(currentLine.end));
        ingredientNav.dismiss(splitIngredientLine(newLine).rest);
        setPendingCursor(currentLine.start + newLine.length);
    }

    useEffect(() => {
        if (pendingCursor === null || !ingredientsRef.current) return;
        const el = ingredientsRef.current;
        el.focus();
        el.setSelectionRange(pendingCursor, pendingCursor);
        setIngredientCursor(pendingCursor);
        setPendingCursor(null);
    }, [pendingCursor]);

    useEffect(() => {
        if (isOpen) {
            if (dinnerToEdit) {
                setActiveTab('new');
                setNewDish(dinnerToEdit.dish);
                setNewIngredients((dinnerToEdit.ingredients || []).join('\n'));
                setNewRecipeLink(dinnerToEdit.recipeLink || '');
                setNewImageUrl(dinnerToEdit.imageUrl || '');
            } else {
                setActiveTab('archive');
                setNewDish('');
                setNewIngredients('');
                setNewRecipeLink('');
                setNewImageUrl('');
            }
            setPasteText('');
            setParsed(null);
            setImageOptions([]);
            setImageIndex(0);
        }
    }, [isOpen, dinnerToEdit]);

    // Auto-parse paste text
    useEffect(() => {
        const result = parseRecipeText(pasteText);
        setParsed(result);
    }, [pasteText]);

    // Auto-fetch images when parsed dish name appears
    useEffect(() => {
        if (parsed?.dish) {
            setImageOptions([]);
            setImageIndex(0);
            handleFetchImages(parsed.dish);
        }
    }, [parsed?.dish]);

    // Debounced image fetch for manual dish name input
    useEffect(() => {
        if (activeTab !== 'new' || !newDish.trim()) return;
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setImageOptions([]);
            setImageIndex(0);
            handleFetchImages(newDish);
        }, 800);
        return () => clearTimeout(debounceRef.current);
    }, [newDish, activeTab]);

    async function handleFetchImages(dishName) {
        if (!dishName?.trim()) return;
        setImageFetching(true);
        try {
            const urls = await fetchDinnerImages(dishName);
            setImageOptions(urls);
            setImageIndex(0);
            // Auto-populate imageUrl field in manual tab
            if (activeTab === 'new' && urls.length > 0) {
                setNewImageUrl(urls[0]);
            }
        } finally {
            setImageFetching(false);
        }
    }

    function cycleImage() {
        const next = (imageIndex + 1) % imageOptions.length;
        setImageIndex(next);
        if (activeTab === 'new') setNewImageUrl(imageOptions[next]);
    }

    const suggestedImageUrl = imageOptions[imageIndex] || null;

    if (!isOpen) return null;

    const filteredDinners = dinnerArchive.filter(d =>
        d.dish.toLowerCase().includes(searchTerm.toLowerCase())
    );

    async function handleSaveDinner(e) {
        e.preventDefault();
        if (!newDish.trim()) return;

        setLoading(true);
        try {
            const ingredientsList = newIngredients.split('\n').map(i => i.trim()).filter(Boolean);
            const dinnerData = {
                dish: newDish,
                ingredients: ingredientsList,
                recipeLink: newRecipeLink.trim() || null,
                imageUrl: newImageUrl.trim() || null,
            };

            if (dinnerToEdit) {
                await updateDinnerInArchive(familyId, dinnerToEdit.id, dinnerData);
            } else {
                const docRef = await addDoc(collection(db, `families/${familyId}/dinnerArchive`), dinnerData);
                if (onSelectDinner) {
                    onSelectDinner({ id: docRef.id, ...dinnerData });
                }
            }

            setNewDish('');
            setNewIngredients('');
            setNewRecipeLink('');
            setNewImageUrl('');
            onClose();
        } catch (err) {
            console.error("Error saving dinner:", err);
            alert(t('dinnerModal.errorSave'));
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveParsed(andAdd = false) {
        if (!parsed || !parsed.dish) return;
        setLoading(true);
        try {
            const dinnerData = {
                dish: parsed.dish,
                ingredients: parsed.ingredients,
                parsedIngredients: parsed.parsedIngredients,
                recipeLink: null,
                imageUrl: suggestedImageUrl || null,
                ...(parsed.portions && { portions: parsed.portions }),
                ...(parsed.cookTime && { cookTime: parsed.cookTime }),
                ...(parsed.steps.length > 0 && { steps: parsed.steps }),
            };

            const docRef = await addDoc(collection(db, `families/${familyId}/dinnerArchive`), dinnerData);

            if (andAdd && onSelectDinner) {
                onSelectDinner({ id: docRef.id, ...dinnerData });
            }

            setPasteText('');
            setParsed(null);
            setImageOptions([]);
            onClose();
        } catch (err) {
            console.error("Error saving dinner:", err);
            alert(t('dinnerModal.errorSave'));
        } finally {
            setLoading(false);
        }
    }

    // Shared image picker component (rendered inside each tab)
    function ImagePicker({ currentUrl, onUrlChange }) {
        return (
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">{t('dinnerModal.labelImage')}</label>
                <div className="space-y-2">
                    {/* Suggested image from Unsplash */}
                    {(imageFetching || suggestedImageUrl) && (
                        <div className="relative rounded-xl overflow-hidden bg-white/5 border border-white/10 h-36">
                            {imageFetching ? (
                                <div className="absolute inset-0 flex items-center justify-center gap-2 text-gray-500 text-sm">
                                    <Loader2 size={18} className="animate-spin" />
                                    Henter bilde...
                                </div>
                            ) : suggestedImageUrl ? (
                                <>
                                    <img src={suggestedImageUrl} alt="" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                    <div className="absolute bottom-2 right-2 flex gap-2">
                                        {imageOptions.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={cycleImage}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white text-xs rounded-lg border border-white/20 transition-colors backdrop-blur-sm"
                                            >
                                                <RefreshCw size={12} />
                                                Prøv et annet
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => { setImageOptions([]); onUrlChange(''); }}
                                            className="px-3 py-1.5 bg-black/60 hover:bg-red-500/60 text-white text-xs rounded-lg border border-white/20 transition-colors backdrop-blur-sm"
                                        >
                                            Ingen bilde
                                        </button>
                                    </div>
                                    <div className="absolute top-2 left-2">
                                        <span className="text-xs bg-black/50 text-gray-300 px-2 py-0.5 rounded-full backdrop-blur-sm">Unsplash</span>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    )}

                    {/* Manual URL fallback */}
                    {!suggestedImageUrl && !imageFetching && (
                        <div className="flex gap-3">
                            <input
                                type="url"
                                value={currentUrl}
                                onChange={(e) => onUrlChange(e.target.value)}
                                placeholder={t('dinnerModal.placeholderImage')}
                                className="w-full h-12 bg-background border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            {currentUrl && (
                                <div className="w-12 h-12 rounded-lg border border-white/10 overflow-hidden flex-shrink-0 bg-white/5">
                                    <img src={currentUrl} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-surface rounded-2xl shadow-2xl border border-white/10 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-xl font-bold text-white">
                        {dinnerToEdit ? t('dinnerModal.titleEdit') : t('dinnerModal.titleAdd')}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                {!dinnerToEdit && (
                    <div className="flex border-b border-white/10">
                        <button
                            onClick={() => setActiveTab('archive')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'archive' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            {t('dinnerModal.tabArchive')}
                        </button>
                        <button
                            onClick={() => setActiveTab('new')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'new' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            {t('dinnerModal.tabNew')}
                        </button>
                        <button
                            onClick={() => setActiveTab('paste')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'paste' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <ClipboardPaste size={15} />
                            {t('dinnerModal.tabPaste')}
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-4">

                    {/* Archive tab */}
                    {activeTab === 'archive' && (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={t('dinnerModal.searchPlaceholder')}
                                    className="w-full bg-background border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2">
                                {filteredDinners.map(dinner => (
                                    <button
                                        key={dinner.id}
                                        onClick={() => onSelectDinner && onSelectDinner(dinner)}
                                        className="w-full flex items-center justify-between p-3 bg-surface border border-white/5 rounded-xl hover:bg-white/5 transition-all group text-left gap-3"
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {dinner.imageUrl ? (
                                                <div className="w-10 h-10 rounded-lg bg-white/5 overflow-hidden flex-shrink-0 border border-white/5">
                                                    <img src={dinner.imageUrl} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/5 text-gray-600">
                                                    <ImageIcon size={18} />
                                                </div>
                                            )}
                                            <span className="font-medium text-white group-hover:text-primary transition-colors truncate">{dinner.dish}</span>
                                        </div>
                                        <Plus size={20} className="text-gray-500 group-hover:text-primary flex-shrink-0" />
                                    </button>
                                ))}
                                {filteredDinners.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">{t('dinnerModal.noResults')}</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* New dinner tab */}
                    {activeTab === 'new' && (
                        <form onSubmit={handleSaveDinner} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">{t('dinnerModal.labelDish')}</label>
                                <input
                                    type="text"
                                    value={newDish}
                                    onChange={(e) => setNewDish(e.target.value)}
                                    placeholder={t('dinnerModal.placeholderDish')}
                                    className="w-full bg-background border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">{t('dinnerModal.labelIngredients')}</label>
                                <div className="relative">
                                    <textarea
                                        ref={ingredientsRef}
                                        value={newIngredients}
                                        onChange={(e) => {
                                            setNewIngredients(e.target.value);
                                            setIngredientCursor(e.target.selectionStart);
                                        }}
                                        onSelect={(e) => setIngredientCursor(e.target.selectionStart)}
                                        onKeyDown={ingredientNav.handleKeyDown}
                                        onFocus={ingredientNav.reset}
                                        onBlur={() => ingredientNav.dismiss()}
                                        placeholder={t('dinnerModal.placeholderIngredients')}
                                        className="w-full bg-background border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[120px]"
                                    />
                                    <KnownItemSuggestions
                                        suggestions={ingredientNav.visible ? ingredientSuggestions : []}
                                        activeIndex={ingredientNav.activeIndex}
                                        onHover={ingredientNav.setActiveIndex}
                                        onSelect={selectIngredientSuggestion}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">{t('dinnerModal.labelLink')}</label>
                                <input
                                    type="url"
                                    value={newRecipeLink}
                                    onChange={(e) => setNewRecipeLink(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full bg-background border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>

                            <ImagePicker currentUrl={newImageUrl} onUrlChange={setNewImageUrl} />

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
                                ) : (
                                    <>
                                        <ChefHat size={20} />
                                        {dinnerToEdit ? t('dinnerModal.btnSave') : t('dinnerModal.btnCreate')}
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {/* Paste tab */}
                    {activeTab === 'paste' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">
                                    {t('dinnerModal.pasteLabel')}
                                </label>
                                <textarea
                                    value={pasteText}
                                    onChange={(e) => setPasteText(e.target.value)}
                                    placeholder={t('dinnerModal.pastePlaceholder')}
                                    className="w-full bg-background border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[160px] text-sm font-mono"
                                    autoFocus
                                />
                            </div>

                            {/* Preview */}
                            <div className="bg-background/60 border border-white/5 rounded-xl p-4">
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                                    {t('dinnerModal.pastePreviewTitle')}
                                </p>

                                {parsed && parsed.dish ? (
                                    <div className="space-y-3">
                                        <h3 className="text-lg font-bold text-white">{parsed.dish}</h3>

                                        {(parsed.portions || parsed.cookTime) && (
                                            <div className="flex flex-wrap gap-2">
                                                {parsed.portions && (
                                                    <span className="flex items-center gap-1.5 text-xs bg-primary/15 text-primary border border-primary/20 rounded-full px-3 py-1">
                                                        <Users size={12} />
                                                        {t('dinnerModal.pastePortions', { count: parsed.portions })}
                                                    </span>
                                                )}
                                                {parsed.cookTime && (
                                                    <span className="flex items-center gap-1.5 text-xs bg-secondary/15 text-secondary border border-secondary/20 rounded-full px-3 py-1">
                                                        <Clock size={12} />
                                                        {t('dinnerModal.pasteTime', { time: parsed.cookTime })}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex gap-4 text-sm text-gray-400">
                                            {parsed.ingredients.length > 0 && (
                                                <span>{t('dinnerModal.pasteIngredients', { count: parsed.ingredients.length })}</span>
                                            )}
                                            {parsed.steps.length > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <ListOrdered size={14} />
                                                    {t('dinnerModal.pasteSteps', { count: parsed.steps.length })}
                                                </span>
                                            )}
                                        </div>

                                        {parsed.ingredients.length > 0 && (
                                            <ul className="text-sm text-gray-300 space-y-1 pl-1">
                                                {parsed.ingredients.slice(0, 4).map((ing, i) => (
                                                    <li key={i} className="truncate before:content-['·'] before:mr-2 before:text-gray-600">{ing}</li>
                                                ))}
                                                {parsed.ingredients.length > 4 && (
                                                    <li className="text-gray-500 text-xs">+ {parsed.ingredients.length - 4} til...</li>
                                                )}
                                            </ul>
                                        )}

                                        {/* Image picker in paste tab */}
                                        <ImagePicker
                                            currentUrl={suggestedImageUrl || ''}
                                            onUrlChange={() => {}}
                                        />
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm italic">{t('dinnerModal.pasteNoPreview')}</p>
                                )}
                            </div>

                            {parsed && parsed.dish && (
                                <div className="flex flex-col gap-2">
                                    {onSelectDinner && (
                                        <button
                                            onClick={() => handleSaveParsed(true)}
                                            disabled={loading}
                                            className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {loading ? (
                                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
                                            ) : (
                                                <>
                                                    <ChefHat size={18} />
                                                    {t('dinnerModal.pasteBtnSaveAndAdd')}
                                                </>
                                            )}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleSaveParsed(false)}
                                        disabled={loading}
                                        className="w-full bg-white/5 hover:bg-white/10 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2 border border-white/10 disabled:opacity-50"
                                    >
                                        {t('dinnerModal.pasteBtnSave')}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
