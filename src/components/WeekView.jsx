import { useRef, useEffect } from 'react';
import DayCard from './DayCard';
import { getStartOfWeek, getDayKey } from '../utils/dateUtils';

export default function WeekView({ currentDate, weekPlan, nextWeekPlan, previousWeekPlan, dinnerArchive, onAddDinner, onRemoveDinner, onDinnerClick }) {
    const scrollContainerRef = useRef(null);

    // Drag state refs
    const isDown = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);
    const hasDragged = useRef(false);

    // Generate 15 days (-7 to +7)
    const originalDays = [];
    const startOfCurrentWeek = getStartOfWeek(currentDate);

    for (let i = -7; i <= 7; i++) {
        const date = new Date(currentDate);
        date.setDate(currentDate.getDate() + i);

        const dayKey = getDayKey(date);

        let plan = weekPlan;
        if (date < startOfCurrentWeek) {
            plan = previousWeekPlan;
        } else if (date >= new Date(startOfCurrentWeek.getTime() + 7 * 24 * 60 * 60 * 1000)) {
            plan = nextWeekPlan;
        }

        let dinner = null;
        if (plan && plan[dayKey] && plan[dayKey].dinnerId) {
            dinner = dinnerArchive.find(d => d.id === plan[dayKey].dinnerId);
        }

        originalDays.push({
            date,
            dayKey,
            dinner,
            isNextWeek: false, // Concept of "next week" is blurry now, purely purely cosmetic if used. 
            // Actually, we might want to flag "today" for styling, which is passed in render.
            originalIndex: i + 7 // normalize to 0-14
        });
    }

    // Clone items for infinite loop
    // We clone 4 items on each side to ensure smooth scrolling even on wider screens
    const CLONE_COUNT = 4;
    const displayDays = [
        ...originalDays.slice(-CLONE_COUNT).map(d => ({ ...d, id: `pre-${d.date.getTime()}` })),
        ...originalDays.map(d => ({ ...d, id: `real-${d.date.getTime()}` })),
        ...originalDays.slice(0, CLONE_COUNT).map(d => ({ ...d, id: `post-${d.date.getTime()}` }))
    ];

    // Handle infinite scroll logic
    const handleScroll = () => {
        if (!scrollContainerRef.current) return;

        const container = scrollContainerRef.current;
        const cardWidth = container.children[0].offsetWidth + 16; // Width + gap (approx)
        const totalRealWidth = cardWidth * originalDays.length;

        // Check if we've scrolled into the "pre" clones
        if (container.scrollLeft < cardWidth) {
            container.scrollLeft += totalRealWidth;
        }
        // Check if we've scrolled into the "post" clones
        else if (container.scrollLeft >= totalRealWidth + (cardWidth * CLONE_COUNT)) {
            container.scrollLeft -= totalRealWidth;
        }
    };

    // Mouse Drag Handlers
    const onMouseDown = (e) => {
        isDown.current = true;
        if (scrollContainerRef.current) {
            scrollContainerRef.current.style.cursor = 'grabbing';
            scrollContainerRef.current.style.scrollSnapType = 'none';
        }
        startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
        scrollLeft.current = scrollContainerRef.current.scrollLeft;
        hasDragged.current = false;
    };

    const onMouseLeave = () => {
        isDown.current = false;
        if (scrollContainerRef.current) {
            scrollContainerRef.current.style.cursor = 'default'; // Or grab if you prefer
            scrollContainerRef.current.style.scrollSnapType = 'x mandatory';
        }
    };

    const onMouseUp = () => {
        isDown.current = false;
        if (scrollContainerRef.current) {
            scrollContainerRef.current.style.cursor = 'default';
            scrollContainerRef.current.style.scrollSnapType = 'x mandatory';
        }
    };

    const onMouseMove = (e) => {
        if (!isDown.current) return;
        e.preventDefault();
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX.current); // 1:1 scroll speed
        scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;

        if (Math.abs(walk) > 5) {
            hasDragged.current = true;
        }
    };

    const onClickCapture = (e) => {
        if (hasDragged.current) {
            e.stopPropagation();
            e.preventDefault();
        }
    };

    // Initial scroll to today
    useEffect(() => {
        if (scrollContainerRef.current) {
            const todayIndex = originalDays.findIndex(d => d.date.toDateString() === new Date().toDateString());
            const targetIndex = todayIndex !== -1 ? todayIndex : 0;

            // Calculate position: (Clone offset + Target Index) * Card Width
            // We need to wait for layout to get accurate width, but we can estimate or use a timeout
            setTimeout(() => {
                if (!scrollContainerRef.current) return;
                const card = scrollContainerRef.current.children[0];
                if (card) {
                    const cardWidth = card.offsetWidth + 16; // 16px gap (gap-4)
                    const scrollPos = (CLONE_COUNT + targetIndex) * cardWidth;

                    // Center the card: scrollPos - (containerWidth / 2) + (cardWidth / 2)
                    const containerWidth = scrollContainerRef.current.offsetWidth;
                    const centeredPos = scrollPos - (containerWidth / 2) + (cardWidth / 2);

                    scrollContainerRef.current.scrollLeft = centeredPos;
                }
            }, 100);
        }
    }, []); // Run once on mount

    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    return (
        <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeave}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
            onClickCapture={onClickCapture}
            className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-8 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide cursor-grab"
            style={{ scrollBehavior: 'auto' }} // Disable smooth scroll for instant jumps
        >
            {displayDays.map((day, index) => (
                <DayCard
                    key={day.id || index}
                    date={day.date}
                    dinner={day.dinner}
                    isToday={day.date.toDateString() === today.toDateString()}
                    isYesterday={day.date.toDateString() === yesterday.toDateString()}
                    isTomorrow={day.date.toDateString() === tomorrow.toDateString()}
                    onAddDinner={() => onAddDinner(day)}
                    onRemoveDinner={() => onRemoveDinner(day)}
                    onDinnerClick={() => onDinnerClick(day.dinner)}
                />
            ))}
        </div>
    );
}
