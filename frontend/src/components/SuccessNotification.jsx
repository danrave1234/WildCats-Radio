import { useState, useEffect } from 'react';
import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function SuccessNotification({
  message,
  duration = 5000,
  onClose,
  isVisible = true
}) {
  const [show, setShow] = useState(isVisible);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setShow(false);
    if (onClose) {
      setTimeout(onClose, 300); // Allow time for slide-out animation
    }
  };

  if (!show) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 transform transition-all duration-300">
      <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg shadow-lg p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm font-semibold text-green-800 dark:text-green-200">
            {message}
          </p>
        </div>
        <button
          onClick={handleClose}
          className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 transition-colors"
          aria-label="Close notification"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
