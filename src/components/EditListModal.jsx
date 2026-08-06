import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function EditListModal({ isOpen, onClose, onSave, initialValue = '', title }) {
    const { t } = useTranslation();
    const effectiveTitle = title || t('list.title'); // Fallback title
    const [name, setName] = useState(initialValue);

    useEffect(() => {
        if (isOpen) {
            setName(initialValue);
        }
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (name.trim()) {
            onSave(name.trim());
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-surface rounded-2xl shadow-2xl border border-white/10 flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-lg font-bold text-white">{effectiveTitle}</h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-300 mb-1 block">{t('common.name')}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                            className="w-full bg-background border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder={t('common.enterName')}
                        />
                    </div>

                    <div className="flex gap-3 mt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim()}
                            className="flex-1 py-3 px-4 rounded-xl bg-primary hover:bg-blue-600 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Check size={18} />
                            {t('common.save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
