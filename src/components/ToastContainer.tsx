import { useStore } from '../store/useStore';

export function ToastContainer() {
  const toasts = useStore(s => s.toasts);
  const removeToast = useStore(s => s.removeToast);

  if (toasts.length === 0) return null;

  const icons: Record<string, string> = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast ${toast.type}`}
          onClick={() => removeToast(toast.id)}
          role="alert"
        >
          <span>{icons[toast.type] || 'ℹ️'}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
