import { useState, useEffect } from 'react';
import { db, doc, onSnapshot, collection } from '../services/backend';
import { getWeekDocId, getStartOfWeek } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';

export function useWeeklyPlan(currentDate) {
    const { currentUser } = useAuth();
    const [weekPlan, setWeekPlan] = useState({});
    const [nextWeekPlan, setNextWeekPlan] = useState({});
    const [previousWeekPlan, setPreviousWeekPlan] = useState({});
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

    // Fetch plans and archive
    useEffect(() => {
        if (!familyId) return;

        const startOfWeek = getStartOfWeek(currentDate);
        const currentWeekId = getWeekDocId(startOfWeek);

        const nextWeekStart = new Date(startOfWeek);
        nextWeekStart.setDate(startOfWeek.getDate() + 7);
        const nextWeekId = getWeekDocId(nextWeekStart);

        const previousWeekStart = new Date(startOfWeek);
        previousWeekStart.setDate(startOfWeek.getDate() - 7);
        const previousWeekId = getWeekDocId(previousWeekStart);

        const unsubCurrent = onSnapshot(doc(db, `families/${familyId}/weeklyPlans/${currentWeekId}`), (doc) => {
            setWeekPlan(doc.exists() ? doc.data() : {});
        });

        const unsubNext = onSnapshot(doc(db, `families/${familyId}/weeklyPlans/${nextWeekId}`), (doc) => {
            setNextWeekPlan(doc.exists() ? doc.data() : {});
        });

        const unsubPrevious = onSnapshot(doc(db, `families/${familyId}/weeklyPlans/${previousWeekId}`), (doc) => {
            setPreviousWeekPlan(doc.exists() ? doc.data() : {});
        });

        const unsubArchive = onSnapshot(collection(db, `families/${familyId}/dinnerArchive`), (snapshot) => {
            const dinners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDinnerArchive(dinners.sort((a, b) => a.dish.localeCompare(b.dish, 'no')));
            setLoading(false);
        });

        return () => {
            unsubCurrent();
            unsubNext();
            unsubPrevious();
            unsubArchive();
        };
    }, [familyId, currentDate]);

    return { weekPlan, nextWeekPlan, previousWeekPlan, dinnerArchive, loading, familyId };
}
