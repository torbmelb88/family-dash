import { useState, useEffect } from 'react';
import { useShoppingList } from '../hooks/useShoppingList';
import { addShoppingItem, updateShoppingItem, deleteShoppingItem, clearCheckedItems, createShoppingList, updateShoppingList, deleteShoppingList, setDefaultShoppingList, moveShoppingItem, createShoppingListCategory, updateShoppingListCategory, deleteShoppingListCategory, getCategoryHistory, updateCategoryHistory } from '../services/api';
import { Plus, Trash2, Check, ArrowLeft, MoreVertical, Edit2, Settings, Minus, Star, ClipboardList, ArrowRightLeft, ChevronDown, Play, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import EditListModal from '../components/EditListModal';
import ConfirmModal from '../components/ConfirmModal';
import ChecklistModal from '../components/ChecklistModal';
import MoveItemModal from '../components/MoveItemModal';
import StoreProfilesModal from '../components/StoreProfilesModal';
import StoreMode from '../components/StoreMode';

import { useTranslation } from 'react-i18next';

export default function ShoppingList() {
    const { shoppingLists, activeListId, setActiveListId, items, categories, storeProfiles, loading, familyId, defaultListId } = useShoppingList();
    const { t } = useTranslation();
    const [newItemName, setNewItemName] = useState('');
    const [newItemCategory, setNewItemCategory] = useState('');
    const [selectedProfileId, setSelectedProfileId] = useState('');

    // Modal State
    const [editModal, setEditModal] = useState({ isOpen: false, mode: 'create', initialValue: '' });
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null });
    const [isChecklistOpen, setIsChecklistOpen] = useState(false);
    const [moveModal, setMoveModal] = useState({ isOpen: false, item: null });
    const [isConfiguringProfiles, setIsConfiguringProfiles] = useState(false);
    // State for creating category via item dropdown
    const [pendingItemForCategory, setPendingItemForCategory] = useState(null);

    // Store Mode State
    const [isStoreMode, setIsStoreMode] = useState(false);
    const [showProfilePrompt, setShowProfilePrompt] = useState(false); // If they click Play without profile

    // Filter profiles based on active list
    const availableProfiles = storeProfiles.filter(p => p.listId === activeListId);

    // Auto-select profile if current selection is invalid for this list
    useEffect(() => {
        if (availableProfiles.length > 0) {
            const isValid = availableProfiles.some(p => p.id === selectedProfileId);
            if (!isValid) {
                setSelectedProfileId(availableProfiles[0].id);
            }
        } else if (selectedProfileId) {
            setSelectedProfileId('');
        }
    }, [availableProfiles, selectedProfileId]);

    const selectedProfile = storeProfiles.find(p => p.id === selectedProfileId);
    const isDefault = activeListId === defaultListId;

    // Filter categories strictly by listId.
    // Legacy support: "Global" categories (no listId) only show on the Default list.
    const visibleCategories = categories.filter(c =>
        c.listId === activeListId || (!c.listId && activeListId === defaultListId)
    );

    const sortedCategories = [...visibleCategories].sort((a, b) => {
        if (!selectedProfile || !selectedProfile.categoryOrder) return a.order - b.order;
        const indexA = selectedProfile.categoryOrder.indexOf(a.id);
        const indexB = selectedProfile.categoryOrder.indexOf(b.id);
        if (indexA === -1 && indexB === -1) {
            // If neither is in the profile order, sort alphabetically or by default order
            return a.order - b.order;
        }
        if (indexA === -1) return 1; // Unordered items go to bottom
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    async function handleAddItem(e) {
        e.preventDefault();
        if (!newItemName.trim() || !activeListId || !familyId) return;

        try {
            // Check for category history if no category selected
            let categoryId = newItemCategory || null;
            if (!categoryId) {
                const historyCatId = await getCategoryHistory(familyId, newItemName);
                if (historyCatId) {
                    // Verify that the category still exists in the current list (or is global)
                    // If the category was deleted or belongs to another list, we might ignore it or stick with it if it's still valid.
                    // For simplicity: check if available in standard categories
                    const catExists = categories.some(c => c.id === historyCatId);
                    if (catExists) {
                        categoryId = historyCatId;
                    }
                }
            }

            await addShoppingItem(familyId, activeListId, newItemName, categoryId);

            // Update history if we have a category
            if (categoryId) {
                await updateCategoryHistory(familyId, newItemName, categoryId);
            }

            setNewItemName('');
        } catch (err) {
            console.error("Error adding item:", err);
        }
    }

    async function handleToggleItem(item) {
        try {
            await updateShoppingItem(familyId, activeListId, item.id, { checked: !item.checked });
        } catch (err) {
            console.error("Error toggling item:", err);
        }
    }

    async function handleUpdateQuantity(item, change) {
        const newQuantity = (item.quantity || 1) + change;
        if (newQuantity < 1) return;
        try {
            await updateShoppingItem(familyId, activeListId, item.id, { quantity: newQuantity });
        } catch (err) {
            console.error("Error updating quantity:", err);
        }
    }

    async function handleUpdateCategory(item, categoryId) {
        if (categoryId === 'create_new') {
            setPendingItemForCategory(item);
            setEditModal({ isOpen: true, mode: 'create-category', initialValue: '' });
            return;
        }
        try {
            await updateShoppingItem(familyId, activeListId, item.id, { categoryId });
            // Update history when user manually changes category
            if (categoryId && categoryId !== 'create_new') {
                await updateCategoryHistory(familyId, item.name, categoryId);
            }
        } catch (err) {
            console.error("Error updating category:", err);
        }
    }

    function openCreateListModal() {
        setEditModal({ isOpen: true, mode: 'create', initialValue: '' });
    }

    function openRenameListModal() {
        const activeList = shoppingLists.find(l => l.id === activeListId);
        if (!activeList) return;
        setEditModal({ isOpen: true, mode: 'rename', initialValue: activeList.name });
    }

    const handleSaveList = async (newName) => {
        if (!newName.trim()) return;

        try {
            if (editModal.mode === 'create') {
                await createShoppingList(familyId, newName);
            } else if (editModal.mode === 'rename') {
                await updateShoppingList(familyId, activeListId, { name: newName });
            } else if (editModal.mode === 'create-category') {
                const catId = await createShoppingListCategory(familyId, newName, activeListId);
                if (pendingItemForCategory) {
                    await updateShoppingItem(familyId, activeListId, pendingItemForCategory.id, { categoryId: catId });
                    setPendingItemForCategory(null);
                } else if (newItemCategory === 'create_new') {
                    setNewItemCategory(catId);
                }
            } else if (editModal.mode === 'rename-category') {
                await updateShoppingListCategory(familyId, editModal.categoryId, { name: newName });
            }
            setEditModal({ isOpen: false, mode: 'create', initialValue: '' });
        } catch (error) {
            console.error("Error saving list/category:", error);
            console.error("Error saving list/category:", error);
            alert(t('list.errorSave'));
        }
    };

    const handleDeleteCategory = async (categoryId) => {
        setConfirmModal({
            isOpen: true,
            title: t('list.deleteCategory'),
            message: t('list.confirmDeleteCategory'),
            onConfirm: async () => {
                try {
                    const itemsInCat = items.filter(i => i.categoryId === categoryId);
                    const batchUpdatePromises = itemsInCat.map(item =>
                        updateShoppingItem(familyId, activeListId, item.id, { categoryId: null })
                    );
                    await Promise.all(batchUpdatePromises);

                    await deleteShoppingListCategory(familyId, categoryId);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                } catch (error) {
                    console.error("Error deleting category:", error);
                    alert(t('list.errorDelete'));
                }
            }
        });
    };

    function openDeleteListModal() {
        const activeList = shoppingLists.find(l => l.id === activeListId);
        if (!activeList) return;
        setConfirmModal({
            isOpen: true,
            title: t('list.delete'),
            message: t('list.confirmDelete', { name: activeList.name }),
            action: 'delete'
        });
    }

    function openClearCheckedModal() {
        setConfirmModal({
            isOpen: true,
            title: t('list.clearChecked'),
            message: t('list.confirmClear'),
            action: 'clear'
        });
    }

    async function handleConfirmAction() {
        if (confirmModal.action === 'delete') {
            try {
                await deleteShoppingList(familyId, activeListId);
            } catch (err) {
                console.error("Error deleting list:", err);
                alert("Kunne ikke slette liste.");
            }
        } else if (confirmModal.action === 'clear') {
            try {
                await clearCheckedItems(familyId, activeListId);
            } catch (err) {
                console.error("Error clearing items:", err);
            }
        }
    }

    async function handleSetDefault() {
        if (!familyId || !activeListId) return;
        try {
            await setDefaultShoppingList(familyId, activeListId);
        } catch (err) {
            console.error("Error setting default list:", err);
            alert("Kunne ikke sette som standard.");
        }
    }

    function openMoveModal(item) {
        setMoveModal({ isOpen: true, item });
    }

    async function handleMoveItem(targetListId) {
        if (!moveModal.item || !familyId || !activeListId) return;
        try {
            await moveShoppingItem(familyId, activeListId, targetListId, moveModal.item);
            setMoveModal({ isOpen: false, item: null });
        } catch (err) {
            console.error("Error moving item:", err);
            alert("Kunne ikke flytte vare.");
        }
    }

    const handleStartStoreMode = () => {
        if (selectedProfileId) {
            setIsStoreMode(true);
        } else {
            // Check if there are ANY profiles
            if (availableProfiles.length > 0) {
                // If profiles exist but none selected, maybe auto-select first?
                // Or show prompt. User requirement: "velger man butikkprofil".
                // Simplest: Show small custom alert or just reuse logic to set profile?
                // I'll show a quick prompt or just alert for now.
                // Actually, let's just create a quick small inline prompt/modal for profile selection 
                // OR just open the profile selector dropdown?
                // User said: "Når man starter butikkmodus, så velger man butikkprofil".

                // Let's toggle a state that shows a "Choose Profile" modal -> then starts mode.
                setShowProfilePrompt(true);
            } else {
                // No profiles exist. Just start mode with default sort?
                // "Velger man butikk profil". Implicitly means one exists.
                // If none, maybe just start without profile?
                // Let's warn them or start without.
                if (window.confirm(t('storeMode.noProfile'))) {
                    setIsStoreMode(true);
                }
            }
        }
    };


    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    // Group items by category
    const itemsByCategory = items.reduce((acc, item) => {
        const catId = item.categoryId || 'uncategorized';
        if (!acc[catId]) acc[catId] = [];
        acc[catId].push(item);
        return acc;
    }, {});


    return (
        <div className="min-h-screen bg-background text-white pb-20 sm:pb-0">
            {/* Header */}
            <header
                className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-white/5 px-2 sm:px-4 pb-2 flex items-center gap-2 transition-all"
                style={{ paddingTop: 'max(1rem, calc(env(safe-area-inset-top) + 1rem))' }}
            >
                <Link to="/" className="p-2 text-gray-400 hover:text-white transition-colors flex-shrink-0">
                    <ArrowLeft size={24} className="rtl:rotate-180" />
                </Link>
                <h1 className="text-lg sm:text-xl font-bold flex-grow truncate">{t('list.title')}</h1>
                <div className="flex items-center gap-0 sm:gap-1 border-l border-white/10 pl-1 ml-1 flex-shrink-0">
                    <button
                        onClick={handleSetDefault}
                        className={`p-2 transition-colors ${isDefault ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}`}
                        title={isDefault ? t('list.isDefault') : t('list.setDefault')}
                    >
                        <Star size={18} fill={isDefault ? "currentColor" : "none"} />
                    </button>
                    <button
                        onClick={openRenameListModal}
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                        title={t('list.rename')}
                    >
                        <Edit2 size={18} />
                    </button>
                    <button
                        onClick={openDeleteListModal}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                        title={t('list.delete')}
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </header>

            <main className="p-4 sm:p-8 max-w-3xl mx-auto">
                {/* List Selector (Dropdown) */}
                <div className="flex items-center gap-2 mb-6">
                    <div className="relative flex-grow">
                        <select
                            value={activeListId}
                            onChange={(e) => setActiveListId(e.target.value)}
                            className="w-full appearance-none bg-surface border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 pr-10 text-lg font-medium"
                        >
                            {shoppingLists.map(list => (
                                <option key={list.id} value={list.id} className="bg-surface text-white">
                                    {list.name}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            <ChevronDown size={20} />
                        </div>
                    </div>
                    <button
                        onClick={openCreateListModal}
                        className="bg-surface hover:bg-white/5 border border-white/10 text-primary hover:text-white p-3 rounded-xl transition-colors flex-shrink-0"
                        title="Ny liste"
                    >
                        <Plus size={24} />
                    </button>
                </div>

                {/* Store Profile Selector (New Location) */}
                {availableProfiles.length > 0 && (
                    <div className="flex items-center gap-2 mb-6 bg-surface p-2 rounded-xl border border-white/5">
                        <div className="text-gray-500 pl-2">
                            <Store size={20} />
                        </div>
                        <select
                            value={selectedProfileId}
                            onChange={(e) => setSelectedProfileId(e.target.value)}
                            className="bg-transparent border-none text-sm text-white focus:outline-none flex-grow"
                        >
                            <option value="" className="bg-[#1e293b] text-white">{t('storeMode.defaultSort')}</option>
                            {availableProfiles.map(p => (
                                <option key={p.id} value={p.id} className="bg-[#1e293b] text-white">{p.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleStartStoreMode}
                            className="p-2 bg-green-500/20 text-green-400 hover:text-white hover:bg-green-500 hover:shadow-[0_0_15px_rgba(34,197,94,0.4)] rounded-lg transition-all border border-green-500/20 flex items-center gap-2"
                            title={t('storeMode.start')}
                        >
                            <span className="text-xs font-bold uppercase">{t('storeMode.start')}</span>
                            <Play size={16} fill="currentColor" />
                        </button>
                    </div>
                )}

                {/* Add Item Form */}
                <form onSubmit={handleAddItem} className="mb-4 bg-surface p-4 rounded-2xl border border-white/5 shadow-lg">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input
                            type="text"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            placeholder={t('list.addItemPlaceholder')}
                            className="flex-grow bg-background border border-gray-700 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <select
                            value={newItemCategory}
                            onChange={(e) => {
                                if (e.target.value === 'create_new') {
                                    setEditModal({ isOpen: true, mode: 'create-category', initialValue: '' });
                                    setPendingItemForCategory(null); // Ensure we know it's for new item
                                } else {
                                    setNewItemCategory(e.target.value);
                                }
                            }}
                            className="bg-background border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 sm:w-48"
                        >
                            <option value="">{t('list.noCategory')}</option>
                            {sortedCategories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                            <option value="create_new" className="font-bold text-primary">{t('list.newCategory')}</option>
                        </select>
                        <button
                            type="submit"
                            disabled={!newItemName.trim()}
                            className="bg-primary hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            <Plus size={24} />
                        </button>
                    </div>
                </form>

                {/* Checklist Button */}
                <div className="mb-8 flex justify-end gap-2">
                    <button
                        onClick={() => setIsConfiguringProfiles(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
                    >
                        <Settings size={18} />
                        {t('list.storeProfiles')}
                    </button>
                    <button
                        onClick={() => setIsChecklistOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-secondary hover:text-white hover:bg-secondary/10 rounded-full transition-colors"
                    >
                        <ClipboardList size={18} />
                        {t('list.checklist')}
                    </button>
                </div>

                {/* List Content */}
                <div className="space-y-6">
                    {sortedCategories.map(category => {
                        const categoryItems = itemsByCategory[category.id];
                        if (!categoryItems || categoryItems.length === 0) return null;

                        return (
                            <div key={category.id} className="bg-surface/50 rounded-2xl overflow-hidden border border-white/5">
                                <div className="bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                                    <div className="flex items-center justify-between">
                                        <span>{category.name}</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setEditModal({ isOpen: true, mode: 'rename-category', initialValue: category.name, title: t('list.renameCategory'), categoryId: category.id })}
                                                className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCategory(category.id)}
                                                className="p-1 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded transition-colors"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="divide-y divide-white/5">
                                    {categoryItems.map(item => (
                                        <div
                                            key={item.id}
                                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-white/5 transition-colors gap-3 group"
                                        >
                                            <div
                                                className="flex items-center gap-4 cursor-pointer flex-grow"
                                                onClick={() => handleToggleItem(item)}
                                            >
                                                <div className={`
                          w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0
                          ${item.checked ? 'bg-secondary border-secondary' : 'border-gray-500 group-hover:border-primary'}
                        `}>
                                                    {item.checked && <Check size={14} className="text-white" />}
                                                </div>
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className={`text-lg ${item.checked ? 'text-gray-500 line-through' : 'text-white'}`}>
                                                        {item.name}
                                                    </span>
                                                    {item.note && (
                                                        <span className="text-xs text-gray-500 truncate">{item.note}</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 justify-between w-full mt-2">
                                                {/* Category Selector */}
                                                <select
                                                    value={item.categoryId || ''}
                                                    onChange={(e) => handleUpdateCategory(item, e.target.value)}
                                                    className="bg-background border border-gray-600 rounded-lg py-1 px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary max-w-[140px] flex-shrink"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <option value="" className="bg-[#1e293b] text-white">Ingen</option>
                                                    {sortedCategories.map(cat => (
                                                        <option key={cat.id} value={cat.id} className="bg-[#1e293b] text-white">{cat.name}</option>
                                                    ))}
                                                    <option value="create_new" className="font-bold text-primary">+ Ny kategori...</option>
                                                </select>

                                                <div className="flex items-center gap-3">
                                                    {/* Quantity Controls */}
                                                    <div className="flex items-center bg-background/50 rounded-lg border border-gray-700" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => handleUpdateQuantity(item, -1)}
                                                            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-l-lg disabled:opacity-30"
                                                            disabled={item.quantity <= 1}
                                                        >
                                                            <Minus size={14} />
                                                        </button>
                                                        <span className="w-8 text-center text-sm font-medium text-white">{item.quantity || 1}</span>
                                                        <button
                                                            onClick={() => handleUpdateQuantity(item, 1)}
                                                            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-r-lg"
                                                        >
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>

                                                    {/* Move Item Button */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openMoveModal(item); }}
                                                        className="p-2 bg-white/5 rounded-lg text-gray-200 hover:text-white hover:bg-white/20 border border-white/5"
                                                        title="Flytt til annen liste"
                                                    >
                                                        <ArrowRightLeft size={18} />
                                                    </button>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deleteShoppingItem(familyId, activeListId, item.id); }}
                                                        className="p-2 bg-white/5 rounded-lg text-gray-200 hover:text-red-400 hover:bg-white/20 border border-white/5"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {/* Uncategorized Items */}
                    {itemsByCategory['uncategorized'] && itemsByCategory['uncategorized'].length > 0 && (
                        <div className="bg-surface/50 rounded-2xl overflow-hidden border border-white/5">
                            <div className="bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                                {t('list.uncategorized')}
                            </div>
                            <div className="divide-y divide-white/5">
                                {itemsByCategory['uncategorized'].map(item => (
                                    <div
                                        key={item.id}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-white/5 transition-colors gap-3 group"
                                    >
                                        <div
                                            className="flex items-center gap-4 cursor-pointer flex-grow"
                                            onClick={() => handleToggleItem(item)}
                                        >
                                            <div className={`
                          w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0
                          ${item.checked ? 'bg-secondary border-secondary' : 'border-gray-500 group-hover:border-primary'}
                        `}>
                                                {item.checked && <Check size={14} className="text-white" />}
                                            </div>
                                            <div className="flex flex-col overflow-hidden">
                                                <span className={`text-lg ${item.checked ? 'text-gray-500 line-through' : 'text-white'}`}>
                                                    {item.name}
                                                </span>
                                                {item.note && (
                                                    <span className="text-xs text-gray-500 truncate">{item.note}</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 justify-between w-full mt-2">
                                            {/* Category Selector */}
                                            <select
                                                value={item.categoryId || ''}
                                                onChange={(e) => handleUpdateCategory(item, e.target.value)}
                                                className="bg-background border border-gray-600 rounded-lg py-1 px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary max-w-[140px] flex-shrink"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <option value="" className="text-black">Ingen</option>
                                                {sortedCategories.map(cat => (
                                                    <option key={cat.id} value={cat.id} className="text-black">{cat.name}</option>
                                                ))}
                                                <option value="create_new" className="font-bold text-primary">+ Ny kategori...</option>
                                            </select>

                                            <div className="flex items-center gap-3">
                                                {/* Quantity Controls */}
                                                <div className="flex items-center bg-background/50 rounded-lg border border-gray-700" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => handleUpdateQuantity(item, -1)}
                                                        className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-l-lg disabled:opacity-30"
                                                        disabled={item.quantity <= 1}
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <span className="w-8 text-center text-sm font-medium text-white">{item.quantity || 1}</span>
                                                    <button
                                                        onClick={() => handleUpdateQuantity(item, 1)}
                                                        className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-r-lg"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>

                                                {/* Move Item Button */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openMoveModal(item); }}
                                                    className="p-2 bg-white/5 rounded-lg text-gray-200 hover:text-white hover:bg-white/20 border border-white/5"
                                                    title="Flytt til annen liste"
                                                >
                                                    <ArrowRightLeft size={18} />
                                                </button>

                                                <button
                                                    onClick={(e) => { e.stopPropagation(); deleteShoppingItem(familyId, activeListId, item.id); }}
                                                    className="p-2 bg-white/5 rounded-lg text-gray-200 hover:text-red-400 hover:bg-white/20 border border-white/5"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Clear Button */}
                {items.some(i => i.checked) && (
                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={openClearCheckedModal}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-medium"
                        >
                            <Trash2 size={18} />
                            {t('list.clearChecked')}
                        </button>
                    </div>
                )}
            </main>

            <StoreProfilesModal
                isOpen={isConfiguringProfiles}
                onClose={() => setIsConfiguringProfiles(false)}
                shoppingLists={shoppingLists}
                storeProfiles={storeProfiles}
                categories={categories}
                familyId={familyId}
            />

            <EditListModal
                isOpen={editModal.isOpen}
                onClose={() => setEditModal({ ...editModal, isOpen: false })}
                onSave={handleSaveList}
                initialValue={editModal.initialValue}
                title={
                    editModal.mode === 'create' ? t('list.modalCreate') :
                        editModal.mode === 'rename' ? t('list.modalRename') :
                            t('list.modalNewCat')
                }
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm || handleConfirmAction}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.action === 'delete' ? 'Slett' : 'Fjern'}
            />

            <ChecklistModal
                isOpen={isChecklistOpen}
                onClose={() => setIsChecklistOpen(false)}
                categories={categories}
                activeListId={activeListId}
                shoppingLists={shoppingLists}
            />

            <MoveItemModal
                isOpen={moveModal.isOpen}
                onClose={() => setMoveModal({ isOpen: false, item: null })}
                onMove={handleMoveItem}
                shoppingLists={shoppingLists}
                currentListId={activeListId}
                itemName={moveModal.item?.name}
            />

            {isStoreMode && (
                <StoreMode
                    isOpen={isStoreMode}
                    onClose={() => setIsStoreMode(false)}
                    items={items}
                    storeProfile={selectedProfile}
                    onToggleItem={handleToggleItem}
                    categories={categories}
                />
            )}
            {/* Simple Profile Prompt Modal */}
            {showProfilePrompt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-surface rounded-2xl p-6 w-full max-w-sm border border-white/10">
                        <h3 className="text-xl font-bold text-white mb-4">{t('storeMode.selectProfile')}</h3>
                        <div className="space-y-2">
                            {availableProfiles.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        setSelectedProfileId(p.id);
                                        setShowProfilePrompt(false);
                                        setIsStoreMode(true);
                                    }}
                                    className="w-full text-left p-4 rounded-xl bg-white/5 hover:bg-primary/20 hover:border-primary/50 border border-transparent transition-all text-white font-medium"
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setShowProfilePrompt(false)} className="mt-4 w-full py-3 text-gray-400 hover:text-white">{t('storeMode.cancel')}</button>
                    </div>
                </div>
            )}
        </div>
    );
}
