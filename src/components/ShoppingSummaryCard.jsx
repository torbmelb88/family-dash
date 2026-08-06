import { ShoppingBag, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function ShoppingSummaryCard({ items = [] }) {
    const { t } = useTranslation();

    // Calculate unchecked items
    const uncheckedItems = items.filter(i => !i.checked);
    const totalUnchecked = uncheckedItems.length;

    // Calculate number of lists containing unchecked items
    const listIdsWithUnchecked = new Set(uncheckedItems.map(i => i.listId));
    const activeListCount = listIdsWithUnchecked.size;

    if (totalUnchecked === 0) return null;

    return (
        <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="relative group overflow-hidden rounded-2xl border border-white/10 bg-surface/30 backdrop-blur-md shadow-lg transition-all hover:bg-surface/40">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-4 text-center sm:text-left">
                        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-primary animate-pulse-slow relative">
                            <ShoppingBag size={32} />
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-[#0f172a]">
                                {totalUnchecked}
                            </div>
                        </div>

                        <div className="flex flex-col">
                            <h3 className="text-lg font-bold text-white">
                                {t('dashboard.shoppingSummaryTitle')}
                            </h3>
                            <p className="text-gray-400 text-sm max-w-xs">
                                {t('dashboard.shoppingSummaryDesc', { count: totalUnchecked, lists: activeListCount })}
                            </p>
                        </div>
                    </div>

                    <Link
                        to="/shopping-list"
                        className="w-full sm:w-auto px-6 py-3 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-primary/20"
                    >
                        <span>{t('dashboard.goToShoppingList')}</span>
                        <ArrowRight size={18} />
                    </Link>
                </div>
            </div>
        </div>
    );
}
