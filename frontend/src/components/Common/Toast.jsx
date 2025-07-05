import { useState, useEffect } from 'react';
import { FiX, FiCheck, FiAlertCircle, FiInfo } from 'react-icons/fi';
import './Toast.css';

const Toast = ({ message, type = 'info', duration = 5000, onClose }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // Wait for animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success': return <FiCheck />;
      case 'error': return <FiAlertCircle />;
      case 'warning': return <FiAlertCircle />;
      default: return <FiInfo />;
    }
  };

  return (
    <div className={`toast toast-${type} ${visible ? 'toast-visible' : 'toast-hidden'}`}>
      <div className="toast-icon">
        {getIcon()}
      </div>
      <div className="toast-content">
        <p>{message}</p>
      </div>
      <button className="toast-close" onClick={() => setVisible(false)}>
        <FiX />
      </button>
    </div>
  );
};

// Toast Container
export const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

// Toast Hook
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type, duration };
    
    setToasts(prev => [...prev, toast]);
    
    // Auto remove
    setTimeout(() => {
      removeToast(id);
    }, duration + 300);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showSuccess = (message) => addToast(message, 'success');
  const showError = (message) => addToast(message, 'error');
  const showWarning = (message) => addToast(message, 'warning');
  const showInfo = (message) => addToast(message, 'info');

  return {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo
  };
};

export default Toast;