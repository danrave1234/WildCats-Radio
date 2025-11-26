import { XMarkIcon } from '@heroicons/react/24/outline';

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  type = 'default', 
  showCloseButton = true,
  maxWidth = 'md',
  footer = null,
  zIndex = 'z-50'
}) {
  if (!isOpen) return null;

  // Map type to appropriate styles
  const getBorderStyles = () => {
    switch (type) {
      case 'success':
        return 'border-l-4 border-green-500';
      case 'error':
        return 'border-l-4 border-red-500';
      case 'warning':
        return 'border-l-4 border-yellow-500';
      case 'info':
        return 'border-l-4 border-blue-500';
      case 'maroon':
        return 'border-l-4 border-maroon-600';
      case 'gold':
        return 'border-l-4 border-gold-500';
      default:
        return '';
    }
  };

  const getTitleStyles = () => {
    switch (type) {
      case 'success':
        return 'text-green-700 dark:text-green-300';
      case 'error':
        return 'text-red-700 dark:text-red-300';
      case 'warning':
        return 'text-yellow-700 dark:text-yellow-300';
      case 'info':
        return 'text-blue-700 dark:text-blue-300';
      case 'maroon':
        return 'text-maroon-700 dark:text-maroon-400';
      case 'gold':
        return 'text-gold-600 dark:text-gold-400';
      default:
        return 'text-gray-900 dark:text-white';
    }
  };

  // Map maxWidth to appropriate size class
  const getMaxWidthClass = () => {
    switch (maxWidth) {
      case 'sm':
        return 'max-w-sm';
      case 'md':
        return 'max-w-md';
      case 'lg':
        return 'max-w-lg';
      case 'xl':
        return 'max-w-xl';
      case '2xl':
        return 'max-w-2xl';
      case 'full':
        return 'max-w-full mx-4';
      default:
        return 'max-w-md';
    }
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center ${zIndex} px-4`}>
      {/* Backdrop with blur effect */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm" 
        onClick={onClose}
        aria-hidden="true"
      ></div>
      
      {/* Modal content */}
      <div className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-xl ${getMaxWidthClass()} w-full transform transition-all ${getBorderStyles()}`}>
        {/* Header */}
        {title && (
          <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
            <h3 className={`text-lg font-semibold ${getTitleStyles()}`}>
              {title}
            </h3>
            {showCloseButton && (
              <button 
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 focus:outline-none"
                aria-label="Close modal"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        
        {/* Body */}
        <div className="p-5 text-gray-700 dark:text-gray-300">
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
} 