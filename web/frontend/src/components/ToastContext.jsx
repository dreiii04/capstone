import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

let toastId = 0;

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = ++toastId;
        setToasts(prev => [...prev, { id, message, type, exiting: false }]);

        setTimeout(() => {
            setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 300);
        }, duration);

        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 300);
    }, []);

    const toast = {
        success: (msg, duration) => addToast(msg, 'success', duration),
        error: (msg, duration) => addToast(msg, 'error', duration),
        warning: (msg, duration) => addToast(msg, 'warning', duration),
        info: (msg, duration) => addToast(msg, 'info', duration),
    };

    const typeStyles = {
        success: {
            bg: 'bg-green-50 border-green-200',
            text: 'text-green-800',
            icon: 'fa-solid fa-circle-check text-green-500',
            progress: 'bg-green-400'
        },
        error: {
            bg: 'bg-red-50 border-red-200',
            text: 'text-red-800',
            icon: 'fa-solid fa-circle-xmark text-red-500',
            progress: 'bg-red-400'
        },
        warning: {
            bg: 'bg-amber-50 border-amber-200',
            text: 'text-amber-800',
            icon: 'fa-solid fa-triangle-exclamation text-amber-500',
            progress: 'bg-amber-400'
        },
        info: {
            bg: 'bg-blue-50 border-blue-200',
            text: 'text-blue-800',
            icon: 'fa-solid fa-circle-info text-blue-500',
            progress: 'bg-blue-400'
        }
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none" aria-live="polite">
                {toasts.map((t) => {
                    const style = typeStyles[t.type] || typeStyles.info;
                    return (
                        <div
                            key={t.id}
                            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg min-w-[320px] max-w-[420px] transition-all duration-300 ${style.bg} ${
                                t.exiting
                                    ? 'opacity-0 translate-x-8'
                                    : 'opacity-100 translate-x-0 animate-[slideInRight_0.3s_ease-out]'
                            }`}
                            role="alert"
                        >
                            <i className={`${style.icon} text-base mt-0.5 flex-shrink-0`}></i>
                            <p className={`text-sm font-medium flex-1 ${style.text} m-0 leading-relaxed`}>{t.message}</p>
                            <button
                                onClick={() => removeToast(t.id)}
                                className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 bg-transparent border-none cursor-pointer p-0 mt-0.5"
                                aria-label="Dismiss notification"
                            >
                                <i className="fa-solid fa-xmark text-xs"></i>
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
};
