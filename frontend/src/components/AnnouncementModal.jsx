import Modal from './Modal';

export default function AnnouncementModal({ isOpen, onClose, title, announcementId }) {
  const viewHref = announcementId ? `/announcements/${announcementId}` : '/announcements';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || 'New announcement'} type="maroon" maxWidth="md">
      <div className="space-y-4">
        <p className="text-sm">A new update has just been posted.</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Dismiss
          </button>
          <a
            href={viewHref}
            className="px-4 py-2 rounded-md bg-gold-500 hover:bg-gold-600 text-black font-medium"
            onClick={onClose}
          >
            View announcement
          </a>
        </div>
      </div>
    </Modal>
  );
}


