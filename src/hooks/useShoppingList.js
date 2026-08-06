import { useState, useEffect } from 'react';
import { db, collection, doc, onSnapshot } from '../services/backend';
import { useAuth } from '../contexts/AuthContext';

export function useShoppingList() {
    const { currentUser } = useAuth();
    const [shoppingLists, setShoppingLists] = useState([]);
    const [activeListId, setActiveListId] = useState(null);
    const [defaultListId, setDefaultListId] = useState(null);
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [storeProfiles, setStoreProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [familyId, setFamilyId] = useState(null);

    // Fetch family ID and default list
    useEffect(() => {
        if (!currentUser) return;
        const userRef = doc(db, 'users', currentUser.uid);
        const unsubscribe = onSnapshot(userRef, (userSnap) => {
            if (userSnap.exists()) {
                const fId = userSnap.data().familyId;
                setFamilyId(fId);

                // Fetch family details for default list
                if (fId) {
                    const familyRef = doc(db, 'families', fId);
                    onSnapshot(familyRef, (familySnap) => {
                        if (familySnap.exists()) {
                            setDefaultListId(familySnap.data().defaultShoppingListId || null);
                        }
                    });
                }
            }
        });
        return unsubscribe;
    }, [currentUser]);

    // Fetch lists and categories
    useEffect(() => {
        if (!familyId) return;

        const unsubLists = onSnapshot(collection(db, `families/${familyId}/shoppingLists`), (snapshot) => {
            const lists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setShoppingLists(lists);

            // Set active list: prefer default, then first available
            if (!activeListId && lists.length > 0) {
                if (defaultListId && lists.find(l => l.id === defaultListId)) {
                    setActiveListId(defaultListId);
                } else {
                    setActiveListId(lists[0].id);
                }
            }
        });

        const unsubCategories = onSnapshot(collection(db, `families/${familyId}/shoppingListCategories`), (snapshot) => {
            const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCategories(cats.sort((a, b) => a.order - b.order));
        });

        const unsubProfiles = onSnapshot(collection(db, `families/${familyId}/storeProfiles`), (snapshot) => {
            const profiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStoreProfiles(profiles);
        });

        return () => {
            unsubLists();
            unsubCategories();
            unsubProfiles();
        };
    }, [familyId, defaultListId]); // Re-run if defaultListId changes

    // Fetch items for active list
    useEffect(() => {
        if (!familyId || !activeListId) {
            setItems([]);
            setLoading(false);
            return;
        }

        const unsubItems = onSnapshot(collection(db, `families/${familyId}/shoppingLists/${activeListId}/items`), (snapshot) => {
            const listItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setItems(listItems);
            setLoading(false);
        });

        return () => unsubItems();
    }, [familyId, activeListId]);

    return {
        shoppingLists,
        activeListId,
        setActiveListId,
        defaultListId,
        items,
        categories,
        storeProfiles,
        loading,
        familyId
    };
}

export function useAllShoppingItems(familyId) {
    const [lists, setLists] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // 1. Fetch Lists
    useEffect(() => {
        if (!familyId) return;
        const q = collection(db, `families/${familyId}/shoppingLists`);
        const unsubscribe = onSnapshot(q, (snap) => {
            setLists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return unsubscribe;
    }, [familyId]);

    // 2. Fetch Items for all lists
    useEffect(() => {
        if (!familyId || lists.length === 0) {
            if (lists.length === 0 && !loading) setItems([]);
            return;
        }

        const unsubs = [];
        const itemsByList = {};

        lists.forEach(list => {
            const q = collection(db, `families/${familyId}/shoppingLists/${list.id}/items`);
            const unsub = onSnapshot(q, (snap) => {
                itemsByList[list.id] = snap.docs.map(d => ({
                    id: d.id,
                    listId: list.id, // Critical for aggregation
                    ...d.data()
                }));

                // Flatten and set
                const all = Object.values(itemsByList).flat();
                setItems(all);
            });
            unsubs.push(unsub);
        });

        setLoading(false);

        return () => unsubs.forEach(u => u());
    }, [lists, familyId]);

    return { items, lists, loading };
}
