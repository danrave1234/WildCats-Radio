import { useState, useEffect } from 'react';
import Modal from '../Modal';
import { broadcastApi } from '../../services/api/broadcastApi';
import { authApi } from '../../services/api/authApi';
import { useStreaming } from '../../context/StreamingContext'; // Import useStreaming
import { useAuth } from '../../context/AuthContext'; // Import useAuth

export default function DJHandoverModal({
  isOpen,
  onClose,
  broadcastId,
  currentDJ,
  loggedInUser,
  onHandoverSuccess
}) {
  const { updateActiveSessionId, updateCurrentBroadcast } = useStreaming(); // Use updateCurrentBroadcast
  const { handoverLogin } = useAuth(); // Use handoverLogin from AuthContext
  const [djs, setDjs] = useState([]);
  const [selectedDJId, setSelectedDJId] = useState('');
  const [selectedDJ, setSelectedDJ] = useState(null);
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingDJs, setLoadingDJs] = useState(false);
  const [isSwitchingAccounts, setIsSwitchingAccounts] = useState(false);

  // Fetch DJs when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchDJs();
      setSelectedDJId('');
      setSelectedDJ(null);
      setPassword('');
      setReason('');
      setError(null);
      setIsSwitchingAccounts(false);
    }
  }, [isOpen]);

  // Show password field when DJ is selected and it's not the logged-in user
  useEffect(() => {
    if (selectedDJId) {
      const dj = djs.find(d => d.id === parseInt(selectedDJId));
      // Show password field if:
      // 1. DJ is selected AND
      // 2. Either loggedInUser is null OR selectedDJ is different from loggedInUser
      if (dj && (!loggedInUser || dj.id !== loggedInUser.id)) {
        setSelectedDJ(dj);
      } else {
        setSelectedDJ(null);
        setPassword('');
      }
    } else {
      setSelectedDJ(null);
      setPassword('');
    }
  }, [selectedDJId, loggedInUser, djs]);

  const fetchDJs = async () => {
    setLoadingDJs(true);
    try {
      // Fetch both DJs and Moderators as they are both eligible for handover
      const [djsResponse, moderatorsResponse] = await Promise.all([
        authApi.getUsersByRole('DJ'),
        authApi.getUsersByRole('MODERATOR')
      ]);
      
      const djsList = djsResponse.data || [];
      const moderatorsList = moderatorsResponse.data || [];
      
      // Combine and deduplicate by ID (in case a user has multiple roles or API oddities)
      const allUsers = [...djsList, ...moderatorsList];
      const uniqueUsers = Array.from(new Map(allUsers.map(item => [item.id, item])).values());

      // Filter out current DJ but keep logged-in user (will be greyed out)
      const filteredUsers = uniqueUsers.filter(user =>
        !currentDJ || user.id !== currentDJ.id
      );
      setDjs(filteredUsers);
    } catch (err) {
      console.error('Error fetching DJs/Moderators:', err);
      setError('Failed to load user list');
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

    // Only require password if selected DJ is different from logged-in user
    if (!selectedDJ || (loggedInUser && selectedDJ.id === loggedInUser.id)) {
      setError('Cannot handover to yourself. Please select a different DJ.');
      return;
    }

    if (!password) {
      setError('Please enter the selected DJ\'s password to switch accounts');
      return;
    }

    setIsSwitchingAccounts(true);
    setLoading(true);
    setError(null);

    try {
      // Use handoverLogin from AuthContext to ensure state is updated immediately
      const responseData = await handoverLogin({
        broadcastId,
        newDJId: parseInt(selectedDJId),
        password,
        reason: reason || null
      });

      // --- Start: Retry logic for fetching updated broadcast state ---
      const maxRetries = 5;
      const retryDelayMs = 500; // 0.5 seconds
      let updatedBroadcast = null;

      for (let i = 0; i < maxRetries; i++) {
        const updatedBroadcastResponse = await broadcastApi.getById(broadcastId);
        const fetchedBroadcast = updatedBroadcastResponse.data;

        // Check if the fetched broadcast has the new DJ as currentActiveDJ
        if (fetchedBroadcast?.currentActiveDJ?.id === parseInt(selectedDJId)) {
          updatedBroadcast = fetchedBroadcast;
          break; // Found updated state, exit loop
        }
        
        console.warn(`DJHandoverModal: Fetched broadcast still shows old DJ after handover. Retrying... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }

      if (!updatedBroadcast) {
        throw new Error('Failed to synchronize broadcast state after handover. Please refresh the page.');
      }
      // --- End: Retry logic ---

      // Update global context with the latest broadcast state
      if (updatedBroadcast) {
        updateCurrentBroadcast(updatedBroadcast);
      }
      
      // onHandoverSuccess is usually for notifications or other side-effects
      if (onHandoverSuccess) {
        onHandoverSuccess(responseData);
      }
      onClose();
    } catch (err) {
      console.error('Error initiating handover with account switch:', err);
      // Handle both Axios error response structure and Error object structure
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to switch accounts. Please verify password and try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setIsSwitchingAccounts(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Handover Broadcast"
      type="info"
      maxWidth="lg"
      zIndex="z-[60]"
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
            disabled={loading || !selectedDJId || !password || loadingDJs}
            className="px-4 py-2 text-sm font-medium text-white bg-maroon-600 rounded-lg hover:bg-maroon-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (isSwitchingAccounts ? 'Switching Accounts...' : 'Handing Over...') : 'Switch Accounts'}
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
            Select DJ or Moderator to Handover To
          </label>
          <select
            id="dj-select"
            value={selectedDJId}
            onChange={(e) => setSelectedDJId(e.target.value)}
            disabled={loadingDJs || loading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon-500 disabled:opacity-50"
          >
            <option value="">-- Select DJ or Moderator --</option>
            {djs.map(dj => {
              const isLoggedInUser = loggedInUser && dj.id === loggedInUser.id;
              return (
                <option
                  key={dj.id}
                  value={dj.id}
                  disabled={isLoggedInUser}
                  className={isLoggedInUser ? 'text-gray-400 dark:text-gray-500' : ''}
                >
                  {dj.name || dj.email} {dj.firstname && dj.lastname ? `(${dj.firstname} ${dj.lastname})` : ''}
                  {isLoggedInUser && ' (Current User Account)'}
                </option>
              );
            })}
          </select>
          {loadingDJs && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Loading DJs...</p>
          )}
        </div>

        {selectedDJ && selectedDJId !== loggedInUser?.id && (
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Enter {selectedDJ.email || 'Selected DJ'}'s Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || isSwitchingAccounts}
              placeholder="Enter password to switch accounts"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon-500 disabled:opacity-50"
              required
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              The selected DJ must be present to enter their password. This ensures secure account switching.
            </p>
          </div>
        )}

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
            {loggedInUser && currentDJ.id !== loggedInUser.id && (
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                <strong>You are:</strong> {loggedInUser.name || loggedInUser.email}
              </p>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}

