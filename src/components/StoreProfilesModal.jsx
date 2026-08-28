import { useState } from 'react';
import { Settings, Plus, Edit2, Trash2, X } from 'lucide-react';
import StoreProfileEditor from './StoreProfileEditor';
import ConfirmModal from './ConfirmModal';
import { deleteStoreProfile } from '../services/api';
import { useTranslation } from 'react-i18next';

export default function StoreProfilesModal({ isOpen, onClose, shoppingLists, storeProfiles, categories, familyId }) {
    const { t } = useTranslation();
    const [editingProfile, setEditingProfile] = useState(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [profileToDelete, setProfileToDelete] = useState(null);

    if (!isOpen) return null;

    function handleDelete(profileId) {
        setProfileToDelete(profileId);
    }

    async function confirmDelete() {
        if (!profileToDelete) return;
        try {
            await deleteStoreProfile(familyId, profileToDelete);
        } catch (err) {
            console.error("Error deleting profile:", err);
        }
    }

    function handleEdit(profile) {
        setEditingProfile(profile);
        setIsEditorOpen(true);
    }

    function handleCreate() {
        setEditingProfile(null);
        setIsEditorOpen(true);
    }

    if (isEditorOpen) {
        return (
            <StoreProfileEditor
                familyId={familyId}
                profile={editingProfile}
                categories={categories}
                shoppingLists={shoppingLists}
                onClose={() => setIsEditorOpen(false)}
            />
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" style={{ padding: 'max(1rem, env(safe-area-inset-top)) 1rem' }}>
            <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl border border-white/10 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Settings size={24} />
                        {t('storeProfiles.title')}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-4 flex-grow overflow-y-auto custom-scrollbar space-y-3">
                    {storeProfiles.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">{t('storeProfiles.noProfiles')}</p>
                    ) : (
                        storeProfiles.map(profile => (
                            <div key={profile.id} className="bg-background/50 border border-white/5 rounded-xl p-4 flex items-center justify-between group hover:border-primary/30 transition-colors">
                                <div>
                                    <h3 className="font-bold text-white mb-1">{profile.name}</h3>
                                    <p className="text-xs text-gray-400">
                                        {profile.linkedListIds && profile.linkedListIds.length > 0
                                            ? t('storeProfiles.linkedTo', { count: profile.linkedListIds.length })
                                            : t('storeProfiles.allLists')}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleEdit(profile)}
                                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(profile.id)}
                                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleCreate}
                        className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus size={20} />
                        {t('storeProfiles.newProfile')}
                    </button>
                </div>
            </div>

            <ConfirmModal
                isOpen={!!profileToDelete}
                onClose={() => setProfileToDelete(null)}
                onConfirm={confirmDelete}
                title={t('storeProfiles.deleteTitle')}
                message={t('storeProfiles.confirmDelete')}
            />
        </div>
    );
}
