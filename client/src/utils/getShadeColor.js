// אנחנו משתמשים ב-"export const" (יצוא בשם)
export const getShadeColor = (position) => {
    const pos = parseInt(position, 10) || 0;
    if (pos < 30) return '#2ecc71'; // ירוק
    if (pos >= 30 && pos < 70) return '#f39c12'; // כתום
    return '#e74c3c'; // אדום
};