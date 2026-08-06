import { useState, useEffect } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function StoreMode({ isOpen, onClose, items, storeProfile, onToggleItem, categories }) {
    const { t } = useTranslation();
    const [queue, setQueue] = useState([]);
    const [completedCount, setCompletedCount] = useState(0);
    const [initialCount, setInitialCount] = useState(0);

    // Initialize queue when opening and items change
    useEffect(() => {
        if (isOpen && items.length > 0) {
            // Sort items based on profile
            const sorted = [...items].filter(i => !i.checked).sort((a, b) => {
                if (!storeProfile || !storeProfile.categoryOrder) return 0;

                // Use category ID to find index
                const catIdA = a.categoryId || 'uncategorized';
                const catIdB = b.categoryId || 'uncategorized';

                const indexA = storeProfile.categoryOrder.indexOf(catIdA);
                const indexB = storeProfile.categoryOrder.indexOf(catIdB);

                if (indexA === -1 && indexB === -1) return 0;
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });

            setQueue(sorted);
            setInitialCount(sorted.length);
            setCompletedCount(0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, storeProfile]); // Only re-initialize on open or profile change, NOT on items update (which resets skip order)
    const currentItem = queue[0];
    const category = categories.find(c => c.id === currentItem?.categoryId);
    const progress = initialCount > 0 ? Math.round((completedCount / initialCount) * 100) : 100;

    const handleCheck = () => {
        if (!currentItem) return;
        onToggleItem(currentItem); // Will update the actual database/list

        // Optimistic update for the queue UI
        setQueue(prev => prev.slice(1));
        setCompletedCount(prev => prev + 1);
    };

    const handleSkip = () => {
        if (!currentItem) return;
        // Move to end of queue
        setQueue(prev => [...prev.slice(1), currentItem]);
    };

    if (queue.length === 0) {
        return (
            <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                <div className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-6">
                    <Check size={48} strokeWidth={3} />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">{t('storeMode.finished')}</h2>
                <p className="text-gray-400 mb-8">{t('storeMode.allPicked')}</p>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    className="bg-primary hover:bg-blue-600 text-white font-bold py-4 px-12 rounded-2xl text-lg w-full max-w-sm cursor-pointer shadow-lg shadow-primary/20 transition-transform active:scale-95 pointer-events-auto"
                >
                    {t('storeMode.close')}
                </button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[9999] bg-background flex flex-col">
            {/* Header / Progress */}
            <div className="p-4 flex items-center justify-between border-b border-white/5 bg-surface/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                        {completedCount + 1}/{initialCount}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">
                            {storeProfile ? storeProfile.name : t('storeMode.defaultTitle')}
                        </span>
                        <span className="text-sm font-medium text-white">
                            {t('storeMode.itemsLeft', { count: queue.length })}
                        </span>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10">
                    <X size={24} />
                </button>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-white/5 w-full">
                <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Main Content */}
            <div className="flex-grow flex flex-col items-center justify-center p-6 relative overflow-hidden">
                {/* Category Label */}
                <div className="absolute top-10 text-center animate-in slide-in-from-top-4 duration-500">
                    <span className="px-4 py-1.5 rounded-full bg-white/10 text-sm font-bold text-gray-300 uppercase tracking-widest border border-white/5">
                        {category ? category.name : t('storeMode.noCategory')}
                    </span>
                </div>

                {/* Item Card */}
                <div className="w-full max-w-md bg-surface border border-white/10 rounded-3xl p-8 flex flex-col items-center shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-300">
                    <h1 className="text-4xl sm:text-5xl font-bold text-center text-white mb-4 leading-tight break-words w-full">
                        {currentItem.name}
                    </h1>

                    <div className="flex items-center gap-4 mt-4">
                        <button className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 border border-white/10">
                            <span className="text-xl font-bold">{currentItem.quantity || 1}</span>
                        </button>
                        <span className="text-gray-400 text-lg">stk</span>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="p-6 pb-12 bg-surface/50 backdrop-blur-md border-t border-white/5">
                <div className="max-w-md mx-auto grid grid-cols-2 gap-4">
                    <button
                        onClick={handleSkip}
                        className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                    >
                        <RotateCcw size={32} />
                        <span className="font-bold">{t('storeMode.skip')}</span>
                    </button>

                    <button
                        onClick={handleCheck}
                        className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl bg-green-500 text-white shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all active:scale-95"
                    >
                        <Check size={32} strokeWidth={3} />
                        <span className="font-bold">{t('storeMode.picked')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
