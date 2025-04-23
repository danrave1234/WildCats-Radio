import { useState, useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function Toast({ message, type = 'success', duration = 3000, onClose }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onClose) {
        setTimeout(onClose, 300); // Allow time for fade-out animation
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 transform transition-all duration-300 ${
      isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
    }`}>
      <div className={`rounded-lg shadow-lg p-4 flex items-center space-x-3 ${
        type === 'success' 
          ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
          : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300'
      }`}>
        {type === 'success' ? (
          <CheckCircleIcon className="h-5 w-5 text-green-500 dark:text-green-400" />
        ) : (
          <XCircleIcon className="h-5 w-5 text-red-500 dark:text-red-400" />
        )}
        <p className="text-sm font-medium">{message}</p>
        <button
          onClick={() => {
            setIsVisible(false);
            if (onClose) setTimeout(onClose, 300);
          }}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
} 