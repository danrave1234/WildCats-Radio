import { useState, useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function Toast({ message, type = 'success', duration = 3000, onClose, position = 'bottom-right' }) {
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

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 text-green-800 dark:text-green-300';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-800 dark:text-red-300';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 text-yellow-800 dark:text-yellow-300';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 text-blue-800 dark:text-blue-300';
      case 'maroon':
        return 'bg-maroon-600/95 text-white border-l-4 border-gold-500 shadow-maroon';
      default:
        return 'bg-white dark:bg-gray-800 border-l-4 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-300';
    }
  };

  const getPositionStyles = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      default:
        return 'bottom-4 right-4';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500 dark:text-green-400" />;
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-500 dark:text-red-400" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />;
      case 'info':
        return <InformationCircleIcon className="h-5 w-5 text-blue-500 dark:text-blue-400" />;
      default:
        return null;
    }
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed ${getPositionStyles()} z-50 transform transition-all duration-300 ${
      isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
    }`}>
      <div className={`rounded-lg shadow-lg p-4 flex items-center space-x-3 ${getToastStyles()}`}>
        {getIcon()}
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