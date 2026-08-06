import { useState } from 'react';
import { Plus, Trash2, ChefHat, ExternalLink } from 'lucide-react';
import { getDayName, formatDate } from '../utils/dateUtils';
import RecipeModal from './RecipeModal';
import { useTranslation } from 'react-i18next';

export default function DayCard({ date, dinner, onAddDinner, onRemoveDinner, onDinnerClick, isToday, isYesterday, isTomorrow }) {
    const { t } = useTranslation();
    const dayName = getDayName(date);
    const dateStr = formatDate(date);
    const [showRecipeModal, setShowRecipeModal] = useState(false);

    return (
        <>
            <div className={`
        relative flex-shrink-0 w-[85vw] sm:w-80 snap-center
        bg-surface rounded-2xl overflow-hidden border transition-all duration-300
        ${isToday ? 'border-primary shadow-lg shadow-primary/10' : 'border-white/5'}
        `}>

                <div className="relative z-10 h-full flex flex-col justify-between">
                    {/* Header */}
                    <div className="p-4 bg-white/5 flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold capitalize text-white">{dayName}</h3>
                            <p className="text-sm text-gray-400">{dateStr}</p>
                        </div>
                        {isToday && (
                            <span className="px-2 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
                                {t('dayCard.today')}
                            </span>
                        )}
                        {isYesterday && (
                            <span className="px-2 py-1 rounded-full bg-white/10 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                {t('dayCard.yesterday')}
                            </span>
                        )}
                        {isTomorrow && (
                            <span className="px-2 py-1 rounded-full bg-secondary/20 text-secondary text-xs font-bold uppercase tracking-wider">
                                {t('dayCard.tomorrow')}
                            </span>
                        )}
                    </div>

                    {/* Content */}
                    <div className="p-4 min-h-[120px] flex flex-col">
                        {dinner ? (
                            <div
                                className="flex-grow flex flex-col justify-between group cursor-pointer"
                                onClick={() => onDinnerClick(dinner)}
                            >
                                <div>
                                    {dinner.imageUrl && (
                                        <div className="w-full h-32 rounded-xl bg-black/20 overflow-hidden mb-3 border border-white/5">
                                            <img
                                                src={dinner.imageUrl}
                                                alt={dinner.dish}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className="p-2 rounded-lg bg-secondary/10 text-secondary mt-1">
                                            <ChefHat size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg text-white leading-tight mb-1">{dinner.dish}</h4>
                                            <p className="text-sm text-gray-400 line-clamp-2">
                                                {dinner.ingredients?.join(', ')}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-1">
                                    {dinner.recipeLink && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowRecipeModal(true);
                                            }}
                                            className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                            title={t('dayCard.openRecipe')}
                                        >
                                            <ExternalLink size={18} />
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onRemoveDinner(); }}
                                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                        title={t('dayCard.removeDinner')}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={onAddDinner}
                                className="flex-grow flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-700 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all group"
                            >
                                <div className="p-3 rounded-full bg-gray-800 group-hover:bg-primary/20 text-gray-400 group-hover:text-primary transition-colors">
                                    <Plus size={24} />
                                </div>
                                <span className="text-sm font-medium text-gray-500 group-hover:text-primary">{t('dayCard.addDinner')}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {dinner && dinner.recipeLink && (
                <RecipeModal
                    isOpen={showRecipeModal}
                    onClose={() => setShowRecipeModal(false)}
                    url={dinner.recipeLink}
                />
            )}
        </>
    );
}
