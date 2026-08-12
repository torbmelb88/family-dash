import { useState, useEffect } from 'react';
import { X, Plus, Minus, Trash2, ExternalLink, Clock, Users, ChevronLeft, ChevronRight, CheckCircle2, UtensilsCrossed } from 'lucide-react';
import { useShoppingList } from '../hooks/useShoppingList';
import { addShoppingItem, updateShoppingItem, deleteShoppingItem, getCategoryHistory, updateCategoryHistory } from '../services/api';
import { parseIngredientLine } from '../utils/recipeParser';
import RecipeModal from './RecipeModal';
import CookingModeModal from './CookingModeModal';
import { useTranslation } from 'react-i18next';

export default function DinnerDetailsModal({ isOpen, onClose, dinner }) {
    const { t } = useTranslation();
    const { shoppingLists, familyId, items, setActiveListId, activeListId, defaultListId, categories } = useShoppingList();
    const [selectedListId, setSelectedListId] = useState('');
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [showCookingMode, setShowCookingMode] = useState(false);
    const [activeTab, setActiveTab] = useState('ingredients');
    const [currentStep, setCurrentStep] = useState(0);

    const hasSteps = dinner?.steps && dinner.steps.length > 0;

    useEffect(() => {
        if (shoppingLists.length > 0 && !selectedListId) {
            const targetId = defaultListId && shoppingLists.find(l => l.id === defaultListId)
                ? defaultListId
                : shoppingLists[0].id;
            setSelectedListId(targetId);
            setActiveListId(targetId);
        }
    }, [shoppingLists, defaultListId]);

    useEffect(() => {
        if (isOpen && shoppingLists.length > 0) {
            const targetId = defaultListId && shoppingLists.find(l => l.id === defaultListId)
                ? defaultListId
                : shoppingLists[0].id;
            setSelectedListId(targetId);
            setActiveListId(targetId);
        }
        // Reset to ingredients tab and first step when reopening
        setActiveTab('ingredients');
        setCurrentStep(0);
    }, [isOpen, defaultListId, shoppingLists]);

    useEffect(() => {
        if (selectedListId && selectedListId !== activeListId) {
            setActiveListId(selectedListId);
        }
    }, [selectedListId]);

    if (!isOpen || !dinner) return null;

    async function handleQuantityChange(ingredientName, change, note = '') {
        if (!familyId || !selectedListId) return;
        const existingItem = items.find(i => i.name.toLowerCase() === ingredientName.toLowerCase());
        try {
            if (existingItem) {
                const newQuantity = (existingItem.quantity || 1) + change;
                if (newQuantity < 1) {
                    await deleteShoppingItem(familyId, selectedListId, existingItem.id);
                } else {
                    await updateShoppingItem(familyId, selectedListId, existingItem.id, { quantity: newQuantity });
                }
            } else if (change > 0) {
                let categoryId = null;
                const historyCatId = await getCategoryHistory(familyId, ingredientName);
                if (historyCatId) {
                    const catExists = categories.some(c => c.id === historyCatId);
                    if (catExists) categoryId = historyCatId;
                }
                await addShoppingItem(familyId, selectedListId, ingredientName, categoryId, 1, note);
                if (categoryId) await updateCategoryHistory(familyId, ingredientName, categoryId);
            }
        } catch (err) {
            console.error("Error updating item:", err);
        }
    }

    const totalSteps = hasSteps ? dinner.steps.length : 0;
    const isLastStep = currentStep === totalSteps - 1;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl border border-white/10 flex flex-col max-h-[90vh]">

                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <h2 className="text-xl font-bold text-white truncate">{dinner.dish}</h2>
                            {dinner.recipeLink && (
                                <button
                                    onClick={() => setShowRecipeModal(true)}
                                    className="p-1.5 text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors flex-shrink-0"
                                    title={t('dayCard.openRecipe')}
                                >
                                    <ExternalLink size={18} />
                                </button>
                            )}
                            {hasSteps && (
                                <button
                                    onClick={() => setShowCookingMode(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary/15 text-primary border border-primary/25 rounded-lg hover:bg-primary/25 transition-colors flex-shrink-0"
                                    title={t('dinnerDetails.cookingMode')}
                                >
                                    <UtensilsCrossed size={14} />
                                    {t('dinnerDetails.cookingMode')}
                                </button>
                            )}
                        </div>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors flex-shrink-0">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Metadata chips */}
                    {(dinner.portions || dinner.cookTime) && (
                        <div className="flex gap-2 px-4 pt-3 flex-wrap">
                            {dinner.portions && (
                                <span className="flex items-center gap-1.5 text-xs bg-primary/15 text-primary border border-primary/20 rounded-full px-3 py-1">
                                    <Users size={12} />
                                    {t('dinnerDetails.portions', { count: dinner.portions })}
                                </span>
                            )}
                            {dinner.cookTime && (
                                <span className="flex items-center gap-1.5 text-xs bg-secondary/15 text-secondary border border-secondary/20 rounded-full px-3 py-1">
                                    <Clock size={12} />
                                    {t('dinnerDetails.cookTime', { time: dinner.cookTime })}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Tabs — only when steps exist */}
                    {hasSteps && (
                        <div className="flex border-b border-white/10 mt-3">
                            <button
                                onClick={() => setActiveTab('ingredients')}
                                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'ingredients' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-400 hover:text-white'}`}
                            >
                                {t('dinnerDetails.tabIngredients')}
                            </button>
                            <button
                                onClick={() => { setActiveTab('steps'); setCurrentStep(0); }}
                                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'steps' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-400 hover:text-white'}`}
                            >
                                {t('dinnerDetails.tabSteps')}
                            </button>
                        </div>
                    )}

                    {/* Content */}
                    <div className="flex-grow overflow-y-auto">
                        {activeTab === 'ingredients' && (
                            <div className="p-4">
                                <div className="mb-4">
                                    <label className="text-sm font-medium text-gray-300 mb-2 block">{t('dinnerDetails.selectList')}</label>
                                    <select
                                        value={selectedListId}
                                        onChange={(e) => setSelectedListId(e.target.value)}
                                        className="w-full bg-background border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        {shoppingLists.map(list => (
                                            <option key={list.id} value={list.id}>{list.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {!hasSteps && (
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                                        {t('dinnerDetails.ingredients')}
                                    </h3>
                                )}

                                <div className="space-y-2">
                                    {dinner.ingredients?.map((rawIngredient, index) => {
                                        // Parse live so old dinners and MCP-added dinners get clean names too
                                        const parsed = parseIngredientLine(rawIngredient);
                                        const shoppingName = parsed.name || rawIngredient;
                                        const recipeQuantity = parsed.quantity || '';

                                        const existingItem = items.find(i => i.name.toLowerCase() === shoppingName.toLowerCase());
                                        const listQty = existingItem ? (existingItem.quantity || 1) : 0;

                                        return (
                                            <div
                                                key={index}
                                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${existingItem
                                                    ? 'bg-primary/10 border-primary'
                                                    : 'bg-background border-gray-700'
                                                    }`}
                                            >
                                                <div className="flex flex-col gap-0.5 overflow-hidden mr-2">
                                                    <span className={`font-medium truncate ${existingItem ? 'text-white' : 'text-gray-400'}`}>
                                                        {shoppingName}
                                                    </span>
                                                    {recipeQuantity && (
                                                        <span className="text-xs text-gray-500">{recipeQuantity}</span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-3 flex-shrink-0">
                                                    {existingItem ? (
                                                        <div className="flex items-center bg-background rounded-lg border border-primary/30">
                                                            <button
                                                                onClick={() => handleQuantityChange(shoppingName, -1)}
                                                                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-l-lg"
                                                            >
                                                                {listQty === 1 ? <Trash2 size={16} className="text-red-400" /> : <Minus size={16} />}
                                                            </button>
                                                            <span className="w-8 text-center text-sm font-bold text-white">{listQty}</span>
                                                            <button
                                                                onClick={() => handleQuantityChange(shoppingName, 1, recipeQuantity)}
                                                                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-r-lg"
                                                            >
                                                                <Plus size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleQuantityChange(shoppingName, 1, recipeQuantity)}
                                                            className="p-2 bg-white/5 hover:bg-primary hover:text-white text-gray-400 rounded-lg transition-colors"
                                                        >
                                                            <Plus size={20} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {(!dinner.ingredients || dinner.ingredients.length === 0) && (
                                        <p className="text-gray-500 italic">{t('dinnerDetails.noIngredients')}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'steps' && hasSteps && (
                            <div className="flex flex-col h-full p-4">
                                {/* Step counter */}
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-sm font-medium text-gray-400">
                                        {t('dinnerDetails.stepCounter', { current: currentStep + 1, total: totalSteps })}
                                    </span>
                                    {/* Progress dots */}
                                    <div className="flex gap-1.5">
                                        {dinner.steps.map((_, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setCurrentStep(i)}
                                                className={`rounded-full transition-all ${i === currentStep
                                                    ? 'w-5 h-2 bg-primary'
                                                    : i < currentStep
                                                        ? 'w-2 h-2 bg-primary/40'
                                                        : 'w-2 h-2 bg-white/15'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Step card */}
                                <div className="flex-grow bg-background/60 border border-white/5 rounded-2xl p-5 flex items-start gap-4 min-h-[160px]">
                                    <span className="text-4xl font-black text-primary/30 leading-none select-none flex-shrink-0 mt-0.5">
                                        {currentStep + 1}
                                    </span>
                                    <p className="text-white text-base leading-relaxed">
                                        {dinner.steps[currentStep]}
                                    </p>
                                </div>

                                {/* Navigation */}
                                <div className="flex gap-3 mt-4">
                                    <button
                                        onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
                                        disabled={currentStep === 0}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft size={20} />
                                        {t('dinnerDetails.prevStep')}
                                    </button>

                                    {isLastStep ? (
                                        <button
                                            onClick={onClose}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 transition-colors font-bold"
                                        >
                                            <CheckCircle2 size={20} />
                                            {t('dinnerDetails.done')}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setCurrentStep(s => Math.min(totalSteps - 1, s + 1))}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white hover:bg-blue-600 transition-colors font-bold"
                                        >
                                            {t('dinnerDetails.nextStep')}
                                            <ChevronRight size={20} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {dinner.recipeLink && (
                <RecipeModal
                    isOpen={showRecipeModal}
                    onClose={() => setShowRecipeModal(false)}
                    url={dinner.recipeLink}
                />
            )}

            <CookingModeModal
                isOpen={showCookingMode}
                onClose={() => setShowCookingMode(false)}
                dinner={dinner}
            />
        </>
    );
}
