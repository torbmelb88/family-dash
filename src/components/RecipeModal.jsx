import { X, ExternalLink, Globe } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';

export default function RecipeModal({ isOpen, onClose, url }) {
    const { t } = useTranslation();
    if (!isOpen || !url) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="w-full h-full max-w-6xl bg-surface rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-surface">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Globe size={20} />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <h2 className="text-lg font-bold text-white truncate">{t('recipeModal.title')}</h2>
                            <p className="text-xs text-gray-400 truncate">{url}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                            <ExternalLink size={16} />
                            <span className="hidden sm:inline">{t('recipeModal.openBrowser')}</span>
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-grow bg-white relative flex flex-col">
                    <div className="bg-blue-50 p-2 text-center text-sm text-blue-800 border-b border-blue-100">
                        {t('recipeModal.helpText')}
                        <br className="sm:hidden" />
                        <Trans i18nKey="recipeModal.helpAction" components={{ strong: <strong /> }} />
                    </div>
                    <iframe
                        src={url}
                        className="flex-grow w-full border-0"
                        title="Recipe"
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                    />
                </div>
            </div>
        </div>
    );
}
