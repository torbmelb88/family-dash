import { useState } from 'react';
import { useWeeklyPlan } from '../hooks/useWeeklyPlan';
import { useAllShoppingItems } from '../hooks/useShoppingList';
import { addDinnerToDay, removeDinnerFromDay } from '../services/api';
import WeekView from '../components/WeekView';
import AddDinnerModal from '../components/AddDinnerModal';
import DinnerDetailsModal from '../components/DinnerDetailsModal';
import ShoppingSummaryCard from '../components/ShoppingSummaryCard';
import ConfirmModal from '../components/ConfirmModal';
import { Settings, ShoppingCart, User } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useTranslation } from 'react-i18next';

export default function Dashboard() {
    const [currentDate] = useState(new Date());
    const { weekPlan, nextWeekPlan, previousWeekPlan, dinnerArchive, loading, familyId } = useWeeklyPlan(currentDate);
    const { items, lists } = useAllShoppingItems(familyId);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDayForDinner, setSelectedDayForDinner] = useState(null);
    const [dayToRemove, setDayToRemove] = useState(null);
    const [selectedDinnerForDetails, setSelectedDinnerForDetails] = useState(null);

    function handleAddDinnerClick(day) {
        setSelectedDayForDinner(day);
        setIsModalOpen(true);
    }

    function handleDinnerClick(dinner) {
        setSelectedDinnerForDetails(dinner);
    }

    const { t } = useTranslation();

    async function handleSelectDinner(dinner) {
        if (!selectedDayForDinner || !familyId) return;
        try {
            await addDinnerToDay(familyId, selectedDayForDinner.date, dinner.id);
            setIsModalOpen(false);
        } catch (err) {
            console.error("Error adding dinner:", err);
            alert(t('dashboard.errorAddDinner'));
        }
    }

    function handleRemoveDinner(day) {
        if (!familyId) return;
        setDayToRemove(day);
    }

    async function confirmRemoveDinner() {
        if (!familyId || !dayToRemove) return;
        try {
            await removeDinnerFromDay(familyId, dayToRemove.date);
        } catch (err) {
            console.error("Error removing dinner:", err);
            alert(t('dashboard.errorRemoveDinner'));
        }
    }



    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-white pb-20 sm:pb-0">
            {/* Header */}
            <header
                className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-white/5 px-4 pb-4 flex justify-between items-center transition-all"
                style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}
            >
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    {t('app.title')}
                </h1>
                <div className="flex items-center gap-4">
                    <Link to="/shopping-list" className="p-2 text-gray-400 hover:text-white transition-colors">
                        <ShoppingCart size={24} />
                    </Link>
                    <Link to="/settings" className="p-2 text-gray-400 hover:text-white transition-colors">
                        <Settings size={24} />
                    </Link>

                    <Link to="/account" className="p-2 text-gray-400 hover:text-white transition-colors">
                        <User size={24} />
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="p-4 sm:p-8 max-w-7xl mx-auto">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-2">{t('dashboard.dinnerPlan')}</h2>
                    <p className="text-gray-400">{t('dashboard.planDesc')}</p>
                </div>

                <WeekView
                    currentDate={currentDate}
                    weekPlan={weekPlan}
                    nextWeekPlan={nextWeekPlan}
                    previousWeekPlan={previousWeekPlan}
                    dinnerArchive={dinnerArchive}
                    onAddDinner={handleAddDinnerClick}
                    onRemoveDinner={handleRemoveDinner}
                    onDinnerClick={handleDinnerClick}
                />

                <ShoppingSummaryCard items={items} lists={lists} />
            </main>

            {/* Modals */}
            <AddDinnerModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSelectDinner={handleSelectDinner}
                familyId={familyId}
                dinnerArchive={dinnerArchive}
            />
            <DinnerDetailsModal
                isOpen={!!selectedDinnerForDetails}
                onClose={() => setSelectedDinnerForDetails(null)}
                dinner={selectedDinnerForDetails}
            />
            <ConfirmModal
                isOpen={!!dayToRemove}
                onClose={() => setDayToRemove(null)}
                onConfirm={confirmRemoveDinner}
                title={t('dayCard.removeDinner')}
                message={dayToRemove ? t('dashboard.confirmRemoveDinner', { date: dayToRemove.date.toLocaleDateString() }) : ''}
                confirmText={t('common.remove')}
            />
        </div>
    );
}
