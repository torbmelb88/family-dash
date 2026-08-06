import { useState, useEffect, useRef } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { Save, X, GripVertical, Plus, Trash2, Edit2, Check } from 'lucide-react';
import { createStoreProfile, updateStoreProfile, createShoppingListCategory, updateShoppingListCategory, deleteShoppingListCategory } from '../services/api';
import ConfirmModal from './ConfirmModal';
import { useTranslation } from 'react-i18next';

export default function StoreProfileEditor({ familyId, profile, categories, shoppingLists = [], onClose }) {
    const { t } = useTranslation();
    const [name, setName] = useState(profile ? profile.name : '');
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const [orderedCategories, setOrderedCategories] = useState([]);
    const [selectedListId, setSelectedListId] = useState(profile?.listId || '');
    // Support legacy profiles that might have used linkedListIds - take the first one if exists
    useEffect(() => {
        if (!profile?.listId && profile?.linkedListIds && profile.linkedListIds.length > 0) {
            setSelectedListId(profile.linkedListIds[0]);
        }
    }, []);

    const [loading, setLoading] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);

    // Initialize ordered categories based on profile OR selected list (default sort)
    const prevListIdRef = useRef(selectedListId);

    // Initialize ordered categories based on profile OR selected list (default sort)
    // Also handles updates when categories change (e.g. adding new one) without losing order
    useEffect(() => {
        let relevantCategories = [];
        if (selectedListId) {
            relevantCategories = categories.filter(c => c.listId === selectedListId);
        } else {
            // Fallback: show categories with no listId (legacy globals)
            relevantCategories = categories.filter(c => !c.listId);
        }

        const listChanged = prevListIdRef.current !== selectedListId;
        prevListIdRef.current = selectedListId;

        setOrderedCategories(prev => {
            // If unique load, list switched, or empty state: Initialize from profile or default
            if (prev.length === 0 || listChanged) {
                if (profile && profile.categoryOrder) {
                    // Sort relevant categories based on profile order
                    // Note: If profile has order for IDs that are NOT in relevantCategories (e.g. wrong list), they won't show. Good.
                    const sorted = [...relevantCategories].sort((a, b) => {
                        const indexA = profile.categoryOrder.indexOf(a.id);
                        const indexB = profile.categoryOrder.indexOf(b.id);
                        // Items in order array come first
                        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                        if (indexA !== -1) return -1;
                        if (indexB !== -1) return 1;
                        return 0;
                    });
                    return sorted;
                }
                return relevantCategories;
            }

            // If updating existing list (e.g. added category), MERGE to preserve current order
            const currentIds = new Set(relevantCategories.map(c => c.id));
            const activeExisting = prev.filter(c => currentIds.has(c.id));

            const existingIds = new Set(activeExisting.map(c => c.id));
            const newItems = relevantCategories.filter(c => !existingIds.has(c.id));

            return [...activeExisting, ...newItems];
        });
    }, [profile, categories, selectedListId]);

    async function handleSave() {
        if (!name.trim()) return;
        setLoading(true);
        try {
            const categoryOrder = orderedCategories.map(c => c.id);
            const data = {
                name,
                categoryOrder,
                listId: selectedListId || null // Save single list ID
            };

            if (profile) {
                await updateStoreProfile(familyId, profile.id, data);
            } else {
                await createStoreProfile(familyId, name, categoryOrder, selectedListId || null);
            }
            onClose();
        } catch (err) {
            console.error("Error saving profile:", err);
            alert(t('storeProfileEditor.errorSave'));
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateCategory(e) {
        e.preventDefault();
        if (!newCategoryName.trim()) return;

        if (!selectedListId) {
            alert(t('storeProfileEditor.alertSelectList'));
            return;
        }

        setIsCreatingCategory(true);
        try {
            // Use selectedListId to scope the new category
            await createShoppingListCategory(familyId, newCategoryName.trim(), selectedListId);
            setNewCategoryName('');
            // Categories prop will update via parent hook, triggering useEffect above
        } catch (err) {
            console.error("Failed to create category:", err);
            alert(t('storeProfileEditor.errorCreateCategory'));
        } finally {
            setIsCreatingCategory(false);
        }
    }

    async function handleRenameCategory(cat, newName) {
        if (!newName.trim() || newName === cat.name) return;
        try {
            await updateShoppingListCategory(familyId, cat.id, { name: newName });
        } catch (err) {
            console.error("Error renaming category:", err);
            alert(t('storeProfileEditor.errorRename'));
        }
    }

    async function handleDeleteCategory(cat) {
        setConfirmModal({
            isOpen: true,
            title: t('storeProfileEditor.deleteCategory'),
            message: t('storeProfileEditor.confirmDeleteCategory', { name: cat.name }),
            onConfirm: async () => {
                try {
                    await deleteShoppingListCategory(familyId, cat.id);
                } catch (err) {
                    console.error("Error deleting category:", err);
                    alert(t('storeProfileEditor.errorDelete'));
                }
            }
        });
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl border border-white/10 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-xl font-bold text-white">{t('storeProfileEditor.title')}</h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto custom-scrollbar space-y-6">
                    {/* Name Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">{t('storeProfileEditor.labelName')}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-background border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder={t('storeProfileEditor.placeholderName')}
                        />
                    </div>

                    {/* Linked List Selection (Single Select) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">{t('storeProfileEditor.labelList')}</label>
                        <select
                            value={selectedListId}
                            onChange={(e) => setSelectedListId(e.target.value)}
                            className="w-full bg-background border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                            <option value="">{t('storeProfileEditor.optionSelectList')}</option>
                            {shoppingLists.map(list => (
                                <option key={list.id} value={list.id}>
                                    {list.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            {t('storeProfileEditor.descList')}
                        </p>
                    </div>

                    {/* Category Sorting */}
                    {selectedListId && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-400">{t('storeProfileEditor.labelSort')}</label>
                            </div>

                            {/* Create New Category Inline */}
                            <form onSubmit={handleCreateCategory} className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder={t('storeProfileEditor.placeholderNewCategory')}
                                    className="flex-grow bg-background/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <button
                                    type="submit"
                                    disabled={!newCategoryName.trim() || isCreatingCategory}
                                    className="bg-secondary/20 text-secondary hover:bg-secondary/30 px-3 py-2 rounded-lg text-sm font-bold transition-colors"
                                >
                                    <Plus size={16} />
                                </button>
                            </form>

                            <div className="bg-background/30 rounded-xl border border-white/5 p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                {orderedCategories.length === 0 ? (
                                    <p className="text-gray-500 text-center text-sm py-4">
                                        {t('storeProfileEditor.emptyCategories')}
                                    </p>
                                ) : (
                                    <Reorder.Group axis="y" values={orderedCategories} onReorder={setOrderedCategories}>
                                        {orderedCategories.map(cat => (
                                            <CategoryItem
                                                key={cat.id}
                                                cat={cat}
                                                onRename={(newName) => handleRenameCategory(cat, newName)}
                                                onDelete={() => handleDeleteCategory(cat)}
                                            />
                                        ))}
                                    </Reorder.Group>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-2 text-center">
                                {t('storeProfileEditor.descDrag')}
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-white/10 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-400 hover:text-white font-medium transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading || !name.trim()}
                        className="bg-primary hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <Save size={18} />
                        {loading ? t('common.loading') : t('common.save')}
                    </button>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={t('common.delete')}
            />
        </div>
    );
}

function CategoryItem({ cat, onRename, onDelete }) {
    const controls = useDragControls();
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(cat.name);

    function handleSave() {
        onRename(editName);
        setIsEditing(false);
    }

    return (
        <Reorder.Item value={cat} dragListener={false} dragControls={controls} className="mb-2 last:mb-0">
            <div className="bg-surface border border-white/5 p-3 rounded-lg flex items-center justify-between hover:border-white/20 transition-colors select-none group">
                {isEditing ? (
                    <div className="flex items-center gap-2 flex-grow mr-2">
                        <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full bg-black/20 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave();
                                if (e.key === 'Escape') setIsEditing(false);
                            }}
                        />
                        <button onClick={handleSave} className="p-1 text-green-400 hover:bg-white/10 rounded">
                            <Check size={16} />
                        </button>
                        <button onClick={() => setIsEditing(false)} className="p-1 text-red-400 hover:bg-white/10 rounded">
                            <X size={16} />
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div
                                onPointerDown={(e) => controls.start(e)}
                                className="p-2 -ml-2 cursor-grab active:cursor-grabbing touch-none text-gray-500 hover:text-white transition-colors"
                            >
                                <GripVertical size={20} />
                            </div>
                            <span className="text-sm font-medium text-gray-200 truncate">{cat.name}</span>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => { setEditName(cat.name); setIsEditing(true); }}
                                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <Edit2 size={16} />
                            </button>
                            <button
                                onClick={onDelete}
                                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Reorder.Item>
    );
}
