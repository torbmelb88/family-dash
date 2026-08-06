import { useState, useEffect } from 'react';
import { db, doc, onSnapshot, collection } from '../services/backend';
import { useAuth } from '../contexts/AuthContext';

export function useFamily() {
    const { currentUser } = useAuth();
    const [family, setFamily] = useState(null);
    const [dinnerArchive, setDinnerArchive] = useState([]);
    const [loading, setLoading] = useState(true);
    const [familyId, setFamilyId] = useState(null);

    // Fetch family ID
    useEffect(() => {
        if (!currentUser) return;
        const userRef = doc(db, 'users', currentUser.uid);
        const unsubscribe = onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
                setFamilyId(doc.data().familyId);
            }
        });
        return unsubscribe;
    }, [currentUser]);

    // Fetch family details and archive
    useEffect(() => {
        if (!familyId) return;

        const unsubFamily = onSnapshot(doc(db, 'families', familyId), (doc) => {
            if (doc.exists()) {
                setFamily({ id: doc.id, ...doc.data() });
            }
        });

        const unsubArchive = onSnapshot(collection(db, `families/${familyId}/dinnerArchive`), (snapshot) => {
            const dinners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDinnerArchive(dinners.sort((a, b) => a.dish.localeCompare(b.dish, 'no')));
            setLoading(false);
        });

        return () => {
            unsubFamily();
            unsubArchive();
        };
    }, [familyId]);

    return { family, dinnerArchive, loading, familyId };
}
