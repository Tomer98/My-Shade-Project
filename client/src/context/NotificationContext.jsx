import { createContext, useState, useContext, useCallback, useRef } from 'react';
import './Notification.css';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [notification, setNotification] = useState(null);

    const timerRef = useRef(null);

    const showNotification = useCallback((message, type = 'info') => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setNotification({ message, type });
        timerRef.current = setTimeout(() => setNotification(null), 3000);
    }, []);

    return (
        <NotificationContext.Provider value={showNotification}>
            {children}
            {notification && (
                <div className={`toast-message ${notification.type}`}>
                    {notification.message}
                </div>
            )}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => useContext(NotificationContext);