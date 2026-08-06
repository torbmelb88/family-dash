
import { db, doc, setDoc, updateDoc, deleteField, collection, addDoc, deleteDoc, writeBatch, query, where, getDocs, getDoc, serverTimestamp } from './backend';
import { getWeekDocId } from '../utils/dateUtils';

export async function addDinnerToDay(familyId, date, dinnerId) {
    const weekDocId = getWeekDocId(date);
    const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];

    const weekPlanRef = doc(db, `families/${familyId}/weeklyPlans/${weekDocId}`);
    await setDoc(weekPlanRef, {
        [dayKey]: { dinnerId: dinnerId }
    }, { merge: true });
}

export async function removeDinnerFromDay(familyId, date) {
    const weekDocId = getWeekDocId(date);
    const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];

    const weekPlanRef = doc(db, `families/${familyId}/weeklyPlans/${weekDocId}`);
    await updateDoc(weekPlanRef, {
        [dayKey]: deleteField()
    });
}

// Shopping List Functions
export async function addShoppingItem(familyId, listId, name, categoryId, quantity = 1) {
    const itemsRef = collection(db, `families/${familyId}/shoppingLists/${listId}/items`);
    await addDoc(itemsRef, {
        name,
        checked: false,
        categoryId: categoryId || null,
        quantity
    });
}

export async function updateShoppingItem(familyId, listId, itemId, updates) {
    const itemRef = doc(db, `families/${familyId}/shoppingLists/${listId}/items`, itemId);
    await updateDoc(itemRef, updates);
}

export async function deleteShoppingItem(familyId, listId, itemId) {
    const itemRef = doc(db, `families/${familyId}/shoppingLists/${listId}/items`, itemId);
    await deleteDoc(itemRef); // Use imported deleteDoc
}

export async function clearCheckedItems(familyId, listId) {
    const itemsRef = collection(db, `families/${familyId}/shoppingLists/${listId}/items`);
    const q = query(itemsRef, where("checked", "==", true));
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();
}

// Admin Functions
export async function deleteDinnerFromArchive(familyId, dinnerId) {
    await deleteDoc(doc(db, `families/${familyId}/dinnerArchive`, dinnerId));
}

export async function updateFamilyMembers(familyId, members) {
    const familyRef = doc(db, 'families', familyId);
    await updateDoc(familyRef, { members });
}

export async function addShoppingItemsBatch(familyId, listId, items) {
    const batch = writeBatch(db);
    const itemsRef = collection(db, `families/${familyId}/shoppingLists/${listId}/items`);

    items.forEach(item => {
        const docRef = doc(itemsRef);
        batch.set(docRef, {
            name: item.name,
            checked: false,
            categoryId: item.categoryId || null, // Support category import
            quantity: 1
        });
    });

    await batch.commit();
}

// Checklist Functions
export async function addChecklistItem(familyId, name, section) {
    const itemsRef = collection(db, `families/${familyId}/checklistItems`);
    await addDoc(itemsRef, {
        name,
        section: section || 'Annet' // Default to 'Annet' if no section provided
    });
}

export async function deleteChecklistItem(familyId, itemId) {
    const itemRef = doc(db, `families/${familyId}/checklistItems`, itemId);
    await deleteDoc(itemRef);
}

export async function updateChecklistItem(familyId, itemId, updates) {
    const itemRef = doc(db, `families/${familyId}/checklistItems`, itemId);
    await updateDoc(itemRef, updates);
}

export async function createChecklistSection(familyId, name) {
    const sectionsRef = collection(db, `families/${familyId}/checklistSections`);
    // Use name as ID to verify uniqueness easily? Or standard ID? 
    // Standard ID is safer for updates/renames later, but name is used as the key currently.
    // For now, let's keep it simple: Add doc.
    await addDoc(sectionsRef, { name });
}

export async function deleteChecklistSection(familyId, sectionId) {
    // Note: Items in this section will become 'Annet' via UI logic, or we should batch update them?
    // User logic implies UI handles fallback.
    const sectionRef = doc(db, `families/${familyId}/checklistSections`, sectionId);
    await deleteDoc(sectionRef);
}

export async function updateChecklistSection(familyId, sectionId, name) {
    const sectionRef = doc(db, `families/${familyId}/checklistSections`, sectionId);
    await updateDoc(sectionRef, { name });
}

export async function createStoreProfile(familyId, name, categoryOrder, listId = null) {
    const profilesRef = collection(db, `families/${familyId}/storeProfiles`);
    await addDoc(profilesRef, { name, categoryOrder, listId });
}

export async function updateStoreProfile(familyId, profileId, updates) {
    const profileRef = doc(db, `families/${familyId}/storeProfiles`, profileId);
    await updateDoc(profileRef, updates);
}

export async function deleteStoreProfile(familyId, profileId) {
    const profileRef = doc(db, `families/${familyId}/storeProfiles`, profileId);
    await deleteDoc(profileRef);
}

export async function createShoppingListCategory(familyId, name, listId = null) {
    const categoriesRef = collection(db, `families/${familyId}/shoppingListCategories`);
    const docRef = await addDoc(categoriesRef, {
        name,
        listId, // Link category to specific list
        order: 999
    });
    return docRef.id;
}

export async function updateShoppingListCategory(familyId, categoryId, updates) {
    const categoryRef = doc(db, `families/${familyId}/shoppingListCategories`, categoryId);
    await updateDoc(categoryRef, updates);
}

export async function deleteShoppingListCategory(familyId, categoryId) {
    const categoryRef = doc(db, `families/${familyId}/shoppingListCategories`, categoryId);
    await deleteDoc(categoryRef);
}

export async function updateDinnerInArchive(familyId, dinnerId, updates) {
    const dinnerRef = doc(db, `families/${familyId}/dinnerArchive`, dinnerId);
    await updateDoc(dinnerRef, updates);
}

export async function createShoppingList(familyId, name) {
    const listsRef = collection(db, `families/${familyId}/shoppingLists`);
    await addDoc(listsRef, { name });
}

export async function updateShoppingList(familyId, listId, updates) {
    const listRef = doc(db, `families/${familyId}/shoppingLists`, listId);
    await updateDoc(listRef, updates);
}

export async function deleteShoppingList(familyId, listId) {
    const listRef = doc(db, 'families', familyId, 'shoppingLists', listId);
    await deleteDoc(listRef);
}

export async function setDefaultShoppingList(familyId, listId) {
    const familyRef = doc(db, 'families', familyId);
    await updateDoc(familyRef, {
        defaultShoppingListId: listId
    });
}
export async function moveShoppingItem(familyId, sourceListId, targetListId, item) {
    const batch = writeBatch(db);

    // Create new item in target list
    const newItemRef = doc(collection(db, `families/${familyId}/shoppingLists/${targetListId}/items`));
    batch.set(newItemRef, {
        name: item.name,
        checked: item.checked, // Preserve checked state? Usually yes.
        categoryId: item.categoryId || null,
        quantity: item.quantity || 1
    });

    // Delete from source list
    const oldItemRef = doc(db, `families/${familyId}/shoppingLists/${sourceListId}/items`, item.id);
    batch.delete(oldItemRef);

    await batch.commit();
}

// Category History / Smart Memory
export async function getCategoryHistory(familyId, itemName) {
    if (!itemName) return null;
    // Basic sanitization for doc ID: remove invalid path chars
    const normalizedName = itemName.trim().toLowerCase().replace(/[#.$/[\]]/g, '');
    if (!normalizedName) return null;

    const docRef = doc(db, `families/${familyId}/categoryHistory/${normalizedName}`);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return docSnap.data().categoryId;
    }
    return null;
}

export async function updateCategoryHistory(familyId, itemName, categoryId) {
    if (!itemName || !categoryId) return;
    const normalizedName = itemName.trim().toLowerCase().replace(/[#.$/[\]]/g, '');
    if (!normalizedName) return;

    const docRef = doc(db, `families/${familyId}/categoryHistory/${normalizedName}`);
    await setDoc(docRef, {
        categoryId,
        updatedAt: serverTimestamp()
    }, { merge: true });
}
