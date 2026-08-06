import i18n from '../i18n';

export function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
}

export function getWeekDocId(date) {
    const startOfWeek = getStartOfWeek(date);
    return `${startOfWeek.getFullYear()}-${String(getWeekNumber(startOfWeek)).padStart(2, '0')}`;
}

export function getDayKey(date) {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return days[date.getDay()];
}

export function formatDate(date) {
    return date.toLocaleDateString(i18n.language, { day: 'numeric', month: 'numeric' });
}

export function getDayName(date) {
    return date.toLocaleDateString(i18n.language, { weekday: 'long' });
}
