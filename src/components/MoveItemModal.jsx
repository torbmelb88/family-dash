import { useState } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';

export default function MoveItemModal({ isOpen, onClose, onMove, shoppingLists, currentListId, itemName }) {
    const { t } = useTranslation();
    const [targetListId, setTargetListId] = useState('');

    if (!isOpen) return null;

    const availableLists = shoppingLists.filter(l => l.id !== currentListId);

    const handleMove = () => {
        if (!targetListId) return;
        onMove(targetListId);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-surface rounded-2xl w-full max-w-md shadow-2xl border border-white/10">
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">{t('moveItem.title')}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <p className="text-gray-300 mb-4">
                        <Trans i18nKey="moveItem.prompt" values={{ name: itemName }} components={{ bold: <span className="font-bold text-white" /> }} />
                    </p>

                    {availableLists.length > 0 ? (
                        <div className="space-y-4">
                            <select
                                value={targetListId}
                                onChange={(e) => setTargetListId(e.target.value)}
                                className="w-full bg-background border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="">{t('moveItem.selectList')}</option>
                                {availableLists.map(list => (
                                    <option key={list.id} value={list.id}>{list.name}</option>
                                ))}
                            </select>

                            <button
                                onClick={handleMove}
                                disabled={!targetListId}
                                className="w-full bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <arrowrightleft size={20} />
                                {t('moveItem.title')}
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-4 bg-white/5 rounded-xl">
                            <p className="text-gray-400">{t('moveItem.noLists')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
