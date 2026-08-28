import { useState, useMemo, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Check, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useChecklist } from '../hooks/useChecklist';
import ConfirmModal from './ConfirmModal';
import { useShoppingList } from '../hooks/useShoppingList'; // [NEW]
import {
    addChecklistItem,
    deleteChecklistItem,
    updateChecklistItem,
    createChecklistSection,
    deleteChecklistSection,
    updateChecklistSection,
    addShoppingItem, // [NEW]
    updateShoppingItem, // [NEW]
    deleteShoppingItem, // [NEW]
    resolveKnownItem,
    updateCategoryHistory // [NEW]
} from '../services/api';

export default function ChecklistModal({ isOpen, onClose }) {
    const { t } = useTranslation();
    const { checklistItems, checklistSections, familyId } = useChecklist();

    // [NEW] Shopping List Integration
    const { items: shoppingItems, activeListId, shoppingLists, setActiveListId, defaultListId, categories } = useShoppingList();
    const [selectedListId, setSelectedListId] = useState('');

    // Confirm dialog state
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    // New Item State
    const [newItemName, setNewItemName] = useState('');
    const [newItemSection, setNewItemSection] = useState('Mat');

    // Editing Item State
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editSection, setEditSection] = useState('');

    // Creating Section State (for Edit Mode)
    const [isCreatingEditSection, setIsCreatingEditSection] = useState(false);
    const [newEditSectionNameInput, setNewEditSectionNameInput] = useState('');

    // Editing Section State
    const [editingSectionId, setEditingSectionId] = useState(null);
    const [editSectionName, setEditSectionName] = useState('');

    // Creating Section State
    const [isCreatingSection, setIsCreatingSection] = useState(false);
    const [newSectionNameInput, setNewSectionNameInput] = useState('');

    // Sync local selection with global active list, prefer default list
    useEffect(() => {
        if (shoppingLists.length > 0 && !selectedListId) {
            const targetId = defaultListId && shoppingLists.find(l => l.id === defaultListId)
                ? defaultListId
                : shoppingLists[0].id;
            setSelectedListId(targetId);
            setActiveListId(targetId);
        }
    }, [shoppingLists, defaultListId]);

    // Update global active list when local selection changes
    useEffect(() => {
        if (selectedListId && selectedListId !== activeListId) {
            setActiveListId(selectedListId);
        }
    }, [selectedListId]);

    // Ensure newItemSection has a valid default
    useEffect(() => {
        if (checklistSections.length > 0) {
            if (!newItemSection || !checklistSections.some(s => s.name === newItemSection)) {
                setNewItemSection(checklistSections[0].name);
            }
        } else {
            setNewItemSection('');
        }
    }, [checklistSections, newItemSection]);


    const groupedItems = useMemo(() => {
        const grouped = {};
        checklistSections.forEach(section => {
            grouped[section.name] = [];
        });
        grouped['__orphans__'] = [];

        checklistItems.forEach(item => {
            let sectionName = item.section;
            if (grouped[sectionName]) {
                grouped[sectionName].push(item);
            } else {
                if (grouped['Annet']) {
                    grouped['Annet'].push(item);
                } else {
                    grouped['__orphans__'].push(item);
                }
            }
        });
        return grouped;
    }, [checklistItems, checklistSections]);

    if (!isOpen) return null;

    // [NEW] Quantity Handler
    const handleQuantityChange = async (itemName, change) => {
        if (!familyId || !selectedListId) return;

        const existingItem = shoppingItems.find(i => i.name.toLowerCase() === itemName.toLowerCase());

        try {
            if (existingItem) {
                const newQuantity = (existingItem.quantity || 1) + change;
                if (newQuantity < 1) {
                    await deleteShoppingItem(familyId, selectedListId, existingItem.id);
                } else {
                    await updateShoppingItem(familyId, selectedListId, existingItem.id, { quantity: newQuantity });
                }
            } else if (change > 0) {
                // Use the family's spelling for known products and their remembered category
                const known = await resolveKnownItem(familyId, itemName);
                let categoryId = null;
                if (known.categoryId) {
                    // Verify category still exists
                    const catExists = categories.some(c => c.id === known.categoryId);
                    if (catExists) {
                        categoryId = known.categoryId;
                    }
                }

                await addShoppingItem(familyId, selectedListId, known.name, categoryId);

                // Update history if we have a category
                if (categoryId) {
                    await updateCategoryHistory(familyId, known.name, categoryId);
                }
            }
        } catch (err) {
            console.error("Error updating item quantity:", err);
            // Optional: Show toast error
        }
    };

    const handleCreateEditSection = async () => {
        if (!newEditSectionNameInput.trim()) return;
        try {
            await createChecklistSection(familyId, newEditSectionNameInput);
            setEditSection(newEditSectionNameInput);
            setIsCreatingEditSection(false);
            setNewEditSectionNameInput('');
        } catch (err) {
            console.error("Error creating section:", err);
            alert(t('checklist.alertCreateSection'));
        }
    };

    const handleCreateSection = async () => {
        if (!newSectionNameInput.trim()) return;
        try {
            await createChecklistSection(familyId, newSectionNameInput);
            setNewItemSection(newSectionNameInput);
            setIsCreatingSection(false);
            setNewSectionNameInput('');
        } catch (err) {
            console.error("Error creating section:", err);
            alert(t('checklist.alertCreateSection'));
        }
    };

    const handleUpdateSection = async (sectionId) => {
        if (!editSectionName.trim()) return;
        try {
            await updateChecklistSection(familyId, sectionId, editSectionName);
            setEditingSectionId(null);
        } catch (err) {
            console.error("Error updating section:", err);
        }
    };

    const handleDeleteSection = (sectionId) => {
        setConfirmModal({
            isOpen: true,
            title: t('checklist.deleteSectionTitle'),
            message: t('checklist.confirmDeleteSection'),
            onConfirm: async () => {
                try {
                    await deleteChecklistSection(familyId, sectionId);
                } catch (err) {
                    console.error("Error deleting section:", err);
                }
            }
        });
    };

    const handleSectionChange = (e) => {
        const value = e.target.value;
        if (value === 'create_new_section') {
            setIsCreatingSection(true);
            setNewItemName('');
        } else {
            setNewItemSection(value);
        }
    };

    const handleAddChecklistItem = async (e) => {
        e.preventDefault();
        if (!newItemName.trim() || !familyId) return;
        try {
            await addChecklistItem(familyId, newItemName, newItemSection);
            setNewItemName('');
        } catch (err) { console.error(err); }
    };

    const handleDeleteItem = (itemId) => {
        setConfirmModal({
            isOpen: true,
            title: t('checklist.deleteItemTitle'),
            message: t('checklist.confirmDeleteItem'),
            onConfirm: async () => {
                try {
                    await deleteChecklistItem(familyId, itemId);
                } catch (err) { console.error(err); }
            }
        });
    };

    const startEditing = (item, e) => {
        e.stopPropagation();
        setEditingId(item.id);
        setEditName(item.name);
        setEditSection(item.section || t('checklist.other'));
        setIsCreatingEditSection(false);
        setNewEditSectionNameInput('');
    };

    const cancelEditing = (e) => {
        e?.stopPropagation();
        setEditingId(null);
        setEditName('');
        setEditSection('');
        setIsCreatingEditSection(false);
        setNewEditSectionNameInput('');
    };

    const saveEditing = async (e) => {
        e.stopPropagation();
        if (!editName.trim() || !familyId) return;

        let finalSection = editSection;
        if (isCreatingEditSection && newEditSectionNameInput.trim()) {
            try {
                await createChecklistSection(familyId, newEditSectionNameInput);
                finalSection = newEditSectionNameInput;
            } catch (err) {
                console.error("Error auto-creating section on save:", err);
                return;
            }
        }

        try {
            await updateChecklistItem(familyId, editingId, { name: editName, section: finalSection });
            setEditingId(null);
            setIsCreatingEditSection(false);
        } catch (err) { console.error(err); alert(t('checklist.errorSave')); }
    };

    const renderSectionHeader = (section) => {
        const isEditing = editingSectionId === section.id;

        if (isEditing) {
            return (
                <div className="flex items-center gap-2 mb-2">
                    <input
                        type="text"
                        value={editSectionName}
                        onChange={(e) => setEditSectionName(e.target.value)}
                        className="bg-transparent border-b border-primary text-sm font-bold text-white uppercase tracking-wider focus:outline-none px-1"
                        autoFocus
                    />
                    <button onClick={() => handleUpdateSection(section.id)} className="text-green-400 hover:text-green-300">
                        <Check size={16} />
                    </button>
                    <button onClick={() => setEditingSectionId(null)} className="text-gray-400 hover:text-gray-300">
                        <X size={16} />
                    </button>
                </div>
            );
        }

        return (
            <div className="flex items-center justify-between group/header mb-2 px-1">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{section.name}</h3>
                <div className="flex items-center gap-2 transition-opacity">
                    <button
                        onClick={() => { setEditingSectionId(section.id); setEditSectionName(section.name); }}
                        className="text-gray-500 hover:text-white"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={() => handleDeleteSection(section.id)}
                        className="text-gray-500 hover:text-red-400"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        );
    };

    const renderItem = (item) => {
        const isEditing = editingId === item.id;

        // [NEW] Check against shopping list
        const existingShoppingItem = shoppingItems.find(i => i.name.toLowerCase() === item.name.toLowerCase());
        const quantity = existingShoppingItem ? (existingShoppingItem.quantity || 1) : 0;
        const existsInList = quantity > 0;

        if (isEditing) {
            return (
                <div key={item.id} className="relative z-10 col-span-1 sm:col-span-2 flex items-center gap-2 p-2 rounded-xl border border-primary/50 bg-primary/10 shadow-lg">
                    <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-grow bg-background border border-gray-600 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-primary min-w-[100px]"
                        autoFocus
                    />

                    {isCreatingEditSection ? (
                        <div className="flex items-center gap-1 bg-background border border-gray-600 rounded-lg px-1 py-0.5">
                            <input
                                type="text"
                                value={newEditSectionNameInput}
                                onChange={(e) => setNewEditSectionNameInput(e.target.value)}
                                placeholder={t('checklist.placeholderSection')}
                                className="bg-transparent text-white text-xs focus:outline-none w-24"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleCreateEditSection();
                                    } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        setIsCreatingEditSection(false);
                                    }
                                }}
                                onClick={(e) => e.stopPropagation()}
                            />
                            <button onClick={(e) => { e.stopPropagation(); handleCreateEditSection(); }} className="text-green-400 hover:text-green-300"><Check size={14} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setIsCreatingEditSection(false); }} className="text-gray-400 hover:text-gray-300"><X size={14} /></button>
                        </div>
                    ) : (
                        <select
                            value={editSection}
                            onChange={(e) => {
                                if (e.target.value === 'create_new_edit_section') {
                                    setIsCreatingEditSection(true);
                                    setNewEditSectionNameInput('');
                                } else {
                                    setEditSection(e.target.value);
                                }
                            }}
                            className="bg-background border border-gray-600 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-primary w-24 sm:w-32"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {checklistSections.map(sec => (
                                <option key={sec.id} value={sec.name}>{sec.name}</option>
                            ))}
                            <option value="create_new_edit_section" className="font-bold text-primary">{t('checklist.optionNewSection')}</option>
                        </select>
                    )}

                    <button onClick={saveEditing} className="p-1.5 text-green-400 hover:bg-green-400/10 rounded-lg">
                        <Check size={18} />
                    </button>
                    <button onClick={cancelEditing} className="p-1.5 text-gray-400 hover:bg-white/10 rounded-lg">
                        <X size={18} />
                    </button>
                </div>
            );
        }

        return (
            <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${existsInList ? 'bg-primary/10 border-primary' : 'bg-background border-white/5'}`}>
                <div className="flex items-center gap-3">
                    <span className={existsInList ? 'text-white font-medium' : 'text-gray-300'}>{item.name}</span>

                    {/* Edit/Delete Checklist Item Buttons (Small, hidden unless group hover or specific intent?) 
                        Actually, let's keep them visible but subtle. 
                    */}
                    <div className="flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
                        <button onClick={(e) => startEditing(item, e)} className="p-1 text-gray-400 hover:text-white"><Edit2 size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }} className="p-1 text-gray-400 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                </div>

                {/* Integration Controls */}
                <div className="flex items-center gap-3">
                    {existsInList ? (
                        <div className="flex items-center bg-background rounded-lg border border-primary/30 shadow-sm">
                            <button
                                onClick={() => handleQuantityChange(item.name, -1)}
                                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-l-lg"
                            >
                                {quantity === 1 ? <Trash2 size={16} className="text-red-400" /> : <Minus size={16} />}
                            </button>
                            <span className="w-8 text-center text-sm font-bold text-white">{quantity}</span>
                            <button
                                onClick={() => handleQuantityChange(item.name, 1)}
                                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-r-lg"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => handleQuantityChange(item.name, 1)}
                            className="p-2 bg-white/5 hover:bg-primary hover:text-white text-gray-400 rounded-lg transition-colors border border-white/5"
                            title={t('checklist.addTo')}
                        >
                            <Plus size={20} />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{ padding: 'max(1rem, env(safe-area-inset-top)) 1rem' }}>
            <div className="bg-surface rounded-2xl w-[95%] sm:w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">{t('checklist.title')}</h2>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"><X size={24} /></button>
                    </div>

                    {/* Shopping List Selector */}
                    <div>
                        <select
                            value={selectedListId}
                            onChange={(e) => setSelectedListId(e.target.value)}
                            className="w-full bg-background border border-gray-700 rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                        >
                            {shoppingLists.map(list => (
                                <option key={list.id} value={list.id}>{list.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto p-4 space-y-6">
                    <form onSubmit={handleAddChecklistItem} className="flex flex-wrap sm:flex-nowrap gap-2 mb-6">
                        <input
                            type="text"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            placeholder={t('checklist.placeholderItem')}
                            className="flex-grow w-full sm:w-auto bg-background border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[150px]"
                        />
                        <div className="flex gap-2 w-full sm:w-auto">
                            {isCreatingSection ? (
                                <div className="flex items-center gap-1 bg-background border border-gray-700 rounded-xl px-2 py-1 flex-grow sm:flex-grow-0">
                                    <input
                                        type="text"
                                        value={newSectionNameInput}
                                        onChange={(e) => setNewSectionNameInput(e.target.value)}
                                        placeholder={t('checklist.placeholderSection')}
                                        className="bg-transparent text-white text-sm focus:outline-none w-full sm:w-32"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleCreateSection();
                                            } else if (e.key === 'Escape') {
                                                setIsCreatingSection(false);
                                            }
                                        }}
                                    />
                                    <button type="button" onClick={handleCreateSection} className="p-1 text-green-400 hover:text-green-300 flex-shrink-0"><Check size={18} /></button>
                                    <button type="button" onClick={() => setIsCreatingSection(false)} className="p-1 text-gray-400 hover:text-gray-300 flex-shrink-0"><X size={18} /></button>
                                </div>
                            ) : (
                                <select
                                    value={newItemSection}
                                    onChange={handleSectionChange}
                                    className="bg-background border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 flex-grow sm:flex-grow-0 max-w-[150px] sm:max-w-none"
                                >
                                    <option value="" disabled>{t('checklist.select')}</option>
                                    {checklistSections.map(sec => (
                                        <option key={sec.id} value={sec.name}>{sec.name}</option>
                                    ))}
                                    <option value="create_new_section" className="font-bold text-primary">{t('checklist.optionNewSection')}</option>
                                </select>
                            )}
                            <button
                                type="submit"
                                disabled={!newItemName.trim() || !newItemSection || isCreatingSection}
                                className="bg-secondary/20 text-secondary hover:bg-secondary/30 disabled:opacity-50 disabled:cursor-not-allowed px-4 rounded-xl transition-colors flex-shrink-0"
                            >
                                <Plus size={24} />
                            </button>
                        </div>
                    </form>

                    {checklistSections.map(section => {
                        const items = groupedItems[section.name];
                        return (
                            <div key={section.id} className="space-y-2">
                                {renderSectionHeader(section)}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {(items || []).map(item => renderItem(item))}
                                </div>
                            </div>
                        );
                    })}

                    {groupedItems['__orphans__'] && groupedItems['__orphans__'].length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider px-1">{t('checklist.other')}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {groupedItems['__orphans__'].map(item => renderItem(item))}
                            </div>
                        </div>
                    )}
                </div>
                {/* No bottom footer needed now */}
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={() => confirmModal.onConfirm && confirmModal.onConfirm()}
                title={confirmModal.title}
                message={confirmModal.message}
            />
        </div>
    );
}

