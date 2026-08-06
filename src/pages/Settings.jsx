import { useState } from 'react';
import { useFamily } from '../hooks/useFamily';
import { useShoppingList } from '../hooks/useShoppingList';
import { deleteDinnerFromArchive, deleteStoreProfile } from '../services/api';
import { ArrowLeft, Search, Trash2, Users, UtensilsCrossed, Copy, Check, Store, Plus, Edit2 } from 'lucide-react';
import StoreProfileEditor from '../components/StoreProfileEditor';
import AddDinnerModal from '../components/AddDinnerModal';
import ConfirmModal from '../components/ConfirmModal';
import { Link } from 'react-router-dom';

import { useTranslation } from 'react-i18next';

export default function Settings() {
    const { dinnerArchive, loading: familyLoading, familyId } = useFamily();
    const { storeProfiles, categories, shoppingLists, loading: listLoading } = useShoppingList();
    const [activeTab, setActiveTab] = useState('archive'); // 'archive' | 'profiles'
    const [searchTerm, setSearchTerm] = useState('');
    const [editingProfile, setEditingProfile] = useState(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingDinner, setEditingDinner] = useState(null);
    const [isDinnerModalOpen, setIsDinnerModalOpen] = useState(false);

    // Confirm Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null
    });

    const loading = familyLoading || listLoading;
    const { t } = useTranslation();

    function handleEditDinner(dinner) {
        setEditingDinner(dinner);
        setIsDinnerModalOpen(true);
    }

    function handleDeleteDinner(dinner) {
        setConfirmModal({
            isOpen: true,
            title: t('settings.deleteDinner'),
            message: t('settings.confirmDeleteDinner', { dish: dinner.dish }),
            onConfirm: async () => {
                try {
                    await deleteDinnerFromArchive(familyId, dinner.id);
                } catch (err) {
                    console.error("Error deleting dinner:", err);
                    alert(t('settings.errorDeleteDinner'));
                }
            }
        });
    }

    function handleDeleteProfile(profile) {
        setConfirmModal({
            isOpen: true,
            title: t('settings.deleteProfile'),
            message: t('settings.confirmDeleteProfile', { name: profile.name }),
            onConfirm: async () => {
                try {
                    await deleteStoreProfile(familyId, profile.id);
                } catch (err) {
                    console.error("Error deleting profile:", err);
                    alert(t('settings.errorDeleteProfile'));
                }
            }
        });
    }

    function handleEditProfile(profile) {
        setEditingProfile(profile);
        setIsEditorOpen(true);
    }

    function handleCreateProfile() {
        setEditingProfile(null);
        setIsEditorOpen(true);
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    const filteredDinners = dinnerArchive.filter(d =>
        d.dish.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background text-white pb-20 sm:pb-0">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-white/5 px-4 py-4 flex items-center gap-4">
                <Link to="/" className="p-2 text-gray-400 hover:text-white transition-colors">
                    <ArrowLeft size={24} className="rtl:rotate-180" />
                </Link>
                <h1 className="text-xl font-bold flex-grow">{t('settings.title')}</h1>
            </header>

            <main className="p-4 sm:p-8 max-w-3xl mx-auto">
                {/* Tabs */}
                <div className="flex bg-surface rounded-xl p-1 mb-6 border border-white/5">
                    <button
                        onClick={() => setActiveTab('archive')}
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'archive' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <UtensilsCrossed size={16} />
                        {t('settings.archive')}
                    </button>
                    <button
                        onClick={() => setActiveTab('profiles')}
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'profiles' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Store size={16} />
                        {t('settings.profiles')}
                    </button>
                </div>

                {/* Content */}
                {activeTab === 'archive' ? (
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-5 w-5" />
                            <input
                                type="text"
                                placeholder={t('settings.searchPlaceholder')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-surface border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>

                        <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
                            <div className="divide-y divide-white/5">
                                {filteredDinners.map(dinner => (
                                    <div key={dinner.id} className="p-4 flex items-center justify-between group hover:bg-white/5 transition-colors">
                                        <div>
                                            <h3 className="font-bold text-white">{dinner.dish}</h3>
                                            <p className="text-sm text-gray-400 line-clamp-1">
                                                {dinner.ingredients?.join(', ')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEditDinner(dinner)}
                                                className="p-2 text-gray-500 hover:text-white transition-colors"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteDinner(dinner)}
                                                className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {filteredDinners.length === 0 && (
                                    <p className="text-center text-gray-500 py-8">{t('settings.noDinners')}</p>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <button
                            onClick={handleCreateProfile}
                            className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={20} />
                            {t('settings.newProfile')}
                        </button>

                        <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
                            <div className="divide-y divide-white/5">
                                {storeProfiles.map(profile => (
                                    <div key={profile.id} className="p-4 flex items-center justify-between group hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <Store className="text-primary" size={20} />
                                            <span className="font-bold text-white">{profile.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEditProfile(profile)}
                                                className="p-2 text-gray-400 hover:text-white transition-colors"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteProfile(profile)}
                                                className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {storeProfiles.length === 0 && (
                                    <p className="text-center text-gray-500 py-8">{t('settings.noProfiles')}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {isEditorOpen && (
                <StoreProfileEditor
                    familyId={familyId}
                    profile={editingProfile}
                    categories={categories}
                    shoppingLists={shoppingLists}
                    onClose={() => setIsEditorOpen(false)}
                />
            )}

            <AddDinnerModal
                isOpen={isDinnerModalOpen}
                onClose={() => {
                    setIsDinnerModalOpen(false);
                    setEditingDinner(null);
                }}
                familyId={familyId}
                dinnerArchive={dinnerArchive}
                dinnerToEdit={editingDinner}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
            />
        </div>
    );
}
