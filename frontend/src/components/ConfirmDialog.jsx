import Modal from './Modal';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to perform this action?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonType = 'danger',
  isLoading = false
}) {
  // Define button style based on type
  const getConfirmButtonStyle = () => {
    switch (confirmButtonType) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
      case 'success':
        return 'bg-green-600 hover:bg-green-700 focus:ring-green-500';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500';
      case 'maroon':
        return 'bg-maroon-700 hover:bg-maroon-800 focus:ring-maroon-600';
      default:
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
    }
  };

  // Footer with confirm and cancel buttons
  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50 focus:ring-blue-500"
        disabled={isLoading}
      >
        {cancelText}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className={`py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${getConfirmButtonStyle()}`}
        disabled={isLoading}
      >
        {isLoading ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </span>
        ) : (
          confirmText
        )}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={isLoading ? null : onClose}
      title={title}
      type="warning"
      maxWidth="sm"
      footer={footer}
      showCloseButton={!isLoading}
    >
      <p className="mb-2">{message}</p>
    </Modal>
  );
} 