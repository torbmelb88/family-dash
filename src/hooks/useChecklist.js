import { useState, useEffect } from 'react';
import { db, collection, onSnapshot, doc } from '../services/backend';
import { useAuth } from '../contexts/AuthContext';

export function useChecklist() {
    const { currentUser } = useAuth();
    const [checklistItems, setChecklistItems] = useState([]);
    const [checklistSections, setChecklistSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [familyId, setFamilyId] = useState(null);

    // Fetch family ID
    useEffect(() => {
        if (!currentUser) return;
        const userRef = doc(db, 'users', currentUser.uid);
        const unsubscribe = onSnapshot(userRef, (userSnap) => {
            if (userSnap.exists()) {
                setFamilyId(userSnap.data().familyId);
            }
        });
        return unsubscribe;
    }, [currentUser]);

    // Fetch checklist items and sections
    useEffect(() => {
        if (!familyId) {
            setChecklistItems([]);
            setChecklistSections([]);
            setLoading(false);
            return;
        }

        const unsubChecklist = onSnapshot(collection(db, `families/${familyId}/checklistItems`), (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            items.sort((a, b) => a.name.localeCompare(b.name));
            setChecklistItems(items);
        });

        const unsubSections = onSnapshot(collection(db, `families/${familyId}/checklistSections`), (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            items.sort((a, b) => a.name.localeCompare(b.name));
            setChecklistSections(items);
        });

        setLoading(false);

        return () => {
            unsubChecklist();
            unsubSections();
        };
    }, [familyId]);

    return {
        checklistItems,
        checklistSections,
        loading,
        familyId
    };
}
