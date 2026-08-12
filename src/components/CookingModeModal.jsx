import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, CheckCircle2, Circle, ChevronDown, ChevronUp, Timer, Play, Pause, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { parseIngredientLine } from '../utils/recipeParser';

const TIMER_PRESETS = [
    { label: '1m', seconds: 60 },
    { label: '3m', seconds: 180 },
    { label: '5m', seconds: 300 },
    { label: '10m', seconds: 600 },
    { label: '15m', seconds: 900 },
];

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CookingModeModal({ isOpen, onClose, dinner }) {
    const { t } = useTranslation();
    const [currentStep, setCurrentStep] = useState(0);
    const [checkedIngredients, setCheckedIngredients] = useState(new Set());
    const [ingredientsOpen, setIngredientsOpen] = useState(false);

    // Timer state
    const [timerPreset, setTimerPreset] = useState(0);   // seconds set
    const [timerRemaining, setTimerRemaining] = useState(0);
    const [timerRunning, setTimerRunning] = useState(false);
    const [timerDone, setTimerDone] = useState(false);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (timerRunning && timerRemaining > 0) {
            intervalRef.current = setInterval(() => {
                setTimerRemaining(r => {
                    if (r <= 1) {
                        clearInterval(intervalRef.current);
                        setTimerRunning(false);
                        setTimerDone(true);
                        return 0;
                    }
                    return r - 1;
                });
            }, 1000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [timerRunning]);

    function selectPreset(seconds) {
        clearInterval(intervalRef.current);
        setTimerPreset(seconds);
        setTimerRemaining(seconds);
        setTimerRunning(false);
        setTimerDone(false);
    }

    function adjustTimer(delta) {
        clearInterval(intervalRef.current);
        const next = Math.max(60, timerPreset + delta);
        setTimerPreset(next);
        setTimerRemaining(next);
        setTimerRunning(false);
        setTimerDone(false);
    }

    function toggleTimer() {
        if (timerDone) {
            setTimerRemaining(timerPreset);
            setTimerDone(false);
            return;
        }
        if (timerRemaining === 0 && timerPreset > 0) {
            setTimerRemaining(timerPreset);
        }
        setTimerRunning(r => !r);
    }

    function resetTimer() {
        clearInterval(intervalRef.current);
        setTimerRemaining(timerPreset);
        setTimerRunning(false);
        setTimerDone(false);
    }

    if (!isOpen || !dinner) return null;

    const steps = dinner.steps || [];
    const totalSteps = steps.length;
    const isLastStep = currentStep === totalSteps - 1;
    const progress = ((currentStep + 1) / totalSteps) * 100;

    const ingredients = dinner.ingredients?.length
        ? dinner.ingredients.map(parseIngredientLine)
        : (dinner.parsedIngredients || []);

    function toggleIngredient(i) {
        setCheckedIngredients(prev => {
            const next = new Set(prev);
            next.has(i) ? next.delete(i) : next.add(i);
            return next;
        });
    }

    function goToStep(n) {
        setCurrentStep(n);
        // Timer keeps running — user may browse steps while waiting
    }

    function handleClose() {
        clearInterval(intervalRef.current);
        setCurrentStep(0);
        setCheckedIngredients(new Set());
        setIngredientsOpen(true);
        setTimerPreset(0);
        setTimerRemaining(0);
        setTimerRunning(false);
        setTimerDone(false);
        onClose();
    }

    const timerProgress = timerPreset > 0 ? (timerRemaining / timerPreset) * 100 : 100;

    return (
        <div className="fixed inset-0 z-[60] bg-background flex flex-col">

            {/* Top bar */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10 flex-shrink-0">
                <h1 className="text-lg sm:text-xl font-bold text-white truncate pr-4">{dinner.dish}</h1>
                <button onClick={handleClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors flex-shrink-0">
                    <X size={22} />
                </button>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-white/10 flex-shrink-0">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>

            {/* Main content */}
            <div className="flex-grow flex flex-col md:flex-row overflow-hidden">

                {/* ── Ingredients panel ── */}
                <div className="md:w-64 lg:w-72 flex-shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-white/10">
                    <button
                        onClick={() => setIngredientsOpen(o => !o)}
                        className="flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white hover:bg-white/5 transition-colors md:cursor-default md:pointer-events-none flex-shrink-0"
                    >
                        <span>
                            {t('dinnerDetails.ingredients')}
                            <span className="ml-2 font-normal normal-case text-gray-600">
                                {checkedIngredients.size}/{ingredients.length}
                            </span>
                        </span>
                        <span className="md:hidden">
                            {ingredientsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </span>
                    </button>

                    <div className={`overflow-y-auto ${ingredientsOpen ? 'flex-grow' : 'hidden md:block md:flex-grow'}`}>
                        <ul className="divide-y divide-white/5 pb-4">
                            {ingredients.map((ing, i) => {
                                const checked = checkedIngredients.has(i);
                                return (
                                    <li key={i}>
                                        <button
                                            onClick={() => toggleIngredient(i)}
                                            className={`w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors ${checked ? 'opacity-40' : ''}`}
                                        >
                                            <span className={`mt-0.5 flex-shrink-0 ${checked ? 'text-primary' : 'text-gray-600'}`}>
                                                {checked ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                                            </span>
                                            <span className="flex flex-col">
                                                <span className={`text-sm font-medium leading-snug ${checked ? 'line-through text-gray-500' : 'text-white'}`}>
                                                    {ing.name}
                                                </span>
                                                {ing.quantity && (
                                                    <span className="text-xs text-gray-500 mt-0.5">{ing.quantity}</span>
                                                )}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>

                {/* ── Steps panel ── */}
                <div className="flex-grow flex flex-col overflow-hidden min-h-0">

                    {/* Step counter + dots */}
                    <div className="flex items-center justify-between px-6 pt-4 pb-3 flex-shrink-0">
                        <span className="text-sm text-gray-500">
                            {t('dinnerDetails.stepCounter', { current: currentStep + 1, total: totalSteps })}
                        </span>
                        <div className="flex gap-1.5 flex-wrap justify-end max-w-[200px]">
                            {steps.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => goToStep(i)}
                                    className={`rounded-full transition-all ${i === currentStep
                                        ? 'w-5 h-2 bg-primary'
                                        : i < currentStep
                                            ? 'w-2 h-2 bg-primary/40'
                                            : 'w-2 h-2 bg-white/15'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Current step card — grows to fill available space */}
                    <div className="flex-grow px-6 pb-3 min-h-0 flex flex-col gap-3">
                        <div className="flex-grow relative rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden flex items-center px-6 py-6">
                            {/* Big watermark number */}
                            <span className="absolute right-4 bottom-2 text-[9rem] font-black leading-none select-none text-white/[0.04] pointer-events-none">
                                {currentStep + 1}
                            </span>
                            <p className="relative text-white text-xl sm:text-2xl leading-relaxed font-medium">
                                {steps[currentStep]}
                            </p>

                            {/* Timer display — bottom-right of card, only on large screens */}
                            {timerPreset > 0 && (
                                <div className="absolute bottom-5 right-5 hidden xl:flex items-end gap-3">
                                    {/* Circular progress */}
                                    <div className="relative w-40 h-40">
                                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                                            <circle
                                                cx="18" cy="18" r="15" fill="none"
                                                stroke={timerDone ? '#f87171' : '#3b82f6'}
                                                strokeWidth="2"
                                                strokeDasharray={`${2 * Math.PI * 15}`}
                                                strokeDashoffset={`${2 * Math.PI * 15 * (1 - timerProgress / 100)}`}
                                                strokeLinecap="round"
                                                className="transition-all duration-1000"
                                            />
                                        </svg>
                                        <span className={`absolute inset-0 flex items-center justify-center text-2xl font-bold tabular-nums tracking-tight ${timerDone ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                                            {timerDone ? '✓' : formatTime(timerRemaining)}
                                        </span>
                                    </div>

                                    <div className="flex flex-col gap-2 pb-2">
                                        <button
                                            onClick={toggleTimer}
                                            className={`p-3 rounded-xl transition-colors ${timerDone
                                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                                : timerRunning
                                                    ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                                                    : 'bg-primary/20 text-primary hover:bg-primary/30'
                                                }`}
                                        >
                                            {timerDone ? <RotateCcw size={22} /> : timerRunning ? <Pause size={22} /> : <Play size={22} />}
                                        </button>
                                        {!timerDone && (timerRunning || timerRemaining < timerPreset) && (
                                            <button onClick={resetTimer} className="p-3 rounded-xl bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                                                <RotateCcw size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Next step hint */}
                        {!isLastStep && (
                            <button
                                onClick={() => goToStep(currentStep + 1)}
                                className="flex-shrink-0 flex items-start gap-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 px-4 py-3 text-left transition-colors group"
                            >
                                <span className="text-xl font-black text-white/15 leading-tight select-none flex-shrink-0 group-hover:text-white/25 transition-colors">
                                    {currentStep + 2}
                                </span>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-0.5">Neste</p>
                                    <p className="text-sm text-gray-500 leading-snug line-clamp-2 group-hover:text-gray-400 transition-colors">
                                        {steps[currentStep + 1]}
                                    </p>
                                </div>
                            </button>
                        )}
                    </div>

                    {/* ── Timer presets ── */}
                    <div className="px-6 py-3 border-t border-white/10 flex-shrink-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Timer size={14} className="text-gray-600 flex-shrink-0" />
                            {TIMER_PRESETS.map(p => (
                                <button
                                    key={p.seconds}
                                    onClick={() => selectPreset(p.seconds)}
                                    className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${timerPreset === p.seconds
                                        ? 'bg-primary text-white font-bold'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                                        }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                            <button onClick={() => adjustTimer(-60)} className="px-2.5 py-1 text-xs rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10">−1m</button>
                            <button onClick={() => adjustTimer(60)} className="px-2.5 py-1 text-xs rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10">+1m</button>

                            {/* Compact timer display — only on tablet/mobile (hidden on lg+) */}
                            {timerPreset > 0 && (
                                <div className="xl:hidden ml-auto flex items-center gap-2">
                                    <div className="relative w-10 h-10">
                                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                                            <circle
                                                cx="18" cy="18" r="15" fill="none"
                                                stroke={timerDone ? '#f87171' : '#3b82f6'}
                                                strokeWidth="2.5"
                                                strokeDasharray={`${2 * Math.PI * 15}`}
                                                strokeDashoffset={`${2 * Math.PI * 15 * (1 - timerProgress / 100)}`}
                                                strokeLinecap="round"
                                                className="transition-all duration-1000"
                                            />
                                        </svg>
                                        <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums ${timerDone ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                                            {timerDone ? '✓' : formatTime(timerRemaining)}
                                        </span>
                                    </div>
                                    <button
                                        onClick={toggleTimer}
                                        className={`p-2 rounded-lg transition-colors ${timerDone
                                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                            : timerRunning
                                                ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                                                : 'bg-primary/20 text-primary hover:bg-primary/30'
                                            }`}
                                    >
                                        {timerDone ? <RotateCcw size={15} /> : timerRunning ? <Pause size={15} /> : <Play size={15} />}
                                    </button>
                                    {!timerDone && (timerRunning || timerRemaining < timerPreset) && (
                                        <button onClick={resetTimer} className="p-2 rounded-lg bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                                            <RotateCcw size={13} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex gap-3 px-6 py-4 border-t border-white/10 flex-shrink-0">
                        <button
                            onClick={() => goToStep(Math.max(0, currentStep - 1))}
                            disabled={currentStep === 0}
                            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
                        >
                            <ChevronLeft size={20} />
                            {t('dinnerDetails.prevStep')}
                        </button>

                        {isLastStep ? (
                            <button
                                onClick={handleClose}
                                className="flex-[2] flex items-center justify-center gap-2 py-4 rounded-2xl bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 transition-colors font-bold"
                            >
                                <CheckCircle2 size={20} />
                                {t('dinnerDetails.done')}
                            </button>
                        ) : (
                            <button
                                onClick={() => goToStep(currentStep + 1)}
                                className="flex-[2] flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary hover:bg-blue-600 text-white font-bold transition-colors text-sm"
                            >
                                {t('dinnerDetails.nextStep')}
                                <ChevronRight size={20} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
