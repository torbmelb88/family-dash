import { X, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText, confirmColor = 'bg-red-500' }) {
    const { t } = useTranslation();
    const effectiveConfirmText = confirmText || t('common.delete');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-surface rounded-2xl shadow-2xl border border-white/10 flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <AlertTriangle size={20} className="text-yellow-500" />
                        {title}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <p className="text-gray-300 text-center">{message}</p>
                </div>

                <div className="flex gap-3 p-4 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={() => { onConfirm(); onClose(); }}
                        className={`flex-1 py-3 px-4 rounded-xl text-white font-bold transition-colors ${confirmColor} hover:opacity-90`}
                    >
                        {effectiveConfirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
