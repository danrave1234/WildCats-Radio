import { useState, useEffect } from 'react';
import Modal from '../Modal';
import { broadcastApi } from '../../services/api/broadcastApi';
import { authApi } from '../../services/api/authApi';

export default function DJHandoverModal({ 
  isOpen, 
  onClose, 
  broadcastId, 
  currentDJ,
  onHandoverSuccess 
}) {
  const [djs, setDjs] = useState([]);
  const [selectedDJId, setSelectedDJId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingDJs, setLoadingDJs] = useState(false);

  // Fetch DJs when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchDJs();
      setSelectedDJId('');
      setReason('');
      setError(null);
    }
  }, [isOpen]);

  const fetchDJs = async () => {
    setLoadingDJs(true);
    try {
      const response = await authApi.getUsersByRole('DJ');
      // Filter out current DJ
      const filteredDJs = (response.data || []).filter(dj => 
        !currentDJ || dj.id !== currentDJ.id
      );
      setDjs(filteredDJs);
    } catch (err) {
      console.error('Error fetching DJs:', err);
      setError('Failed to load DJ list');
    } finally {
      setLoadingDJs(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedDJId) {
      setError('Please select a DJ');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await broadcastApi.initiateHandover(broadcastId, selectedDJId, reason || null);
      if (onHandoverSuccess) {
        onHandoverSuccess();
      }
      onClose();
    } catch (err) {
      console.error('Error initiating handover:', err);
      setError(err.response?.data?.message || 'Failed to initiate handover. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Handover Broadcast"
      type="info"
      maxWidth="md"
      footer={
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedDJId || loadingDJs}
            className="px-4 py-2 text-sm font-medium text-white bg-maroon-600 rounded-lg hover:bg-maroon-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Handing Over...' : 'Handover'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <div>
          <label htmlFor="dj-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select DJ to Handover To
          </label>
          <select
            id="dj-select"
            value={selectedDJId}
            onChange={(e) => setSelectedDJId(e.target.value)}
            disabled={loadingDJs || loading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon-500 disabled:opacity-50"
          >
            <option value="">-- Select DJ --</option>
            {djs.map(dj => (
              <option key={dj.id} value={dj.id}>
                {dj.name || dj.email} {dj.firstname && dj.lastname ? `(${dj.firstname} ${dj.lastname})` : ''}
              </option>
            ))}
          </select>
          {loadingDJs && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Loading DJs...</p>
          )}
        </div>

        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Reason (Optional)
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            rows={3}
            maxLength={500}
            placeholder="e.g., Scheduled shift change, Break time, etc."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon-500 disabled:opacity-50 resize-none"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {reason.length}/500 characters
          </p>
        </div>

        {currentDJ && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Current DJ:</strong> {currentDJ.name || currentDJ.email}
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
}

