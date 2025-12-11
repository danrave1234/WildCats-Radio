import { useState, useEffect } from 'react';
import { 
  KeyIcon,
  BellIcon,
  ShieldCheckIcon,
  XMarkIcon,
  DocumentMagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext.jsx';
import { createLogger } from '../services/logger';
import { appealService } from '../services/api/index.js';

const logger = createLogger('Settings');

export default function Settings() {
  const { currentUser, changePassword, loading } = useAuth();
  const { preferences, updatePreferences } = useNotifications();
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [showModal, setShowModal] = useState(false);

  const [myAppeals, setMyAppeals] = useState([]);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [newAppealReason, setNewAppealReason] = useState('');
  const [appealSubmitting, setAppealSubmitting] = useState(false);

  const [notifications, setNotifications] = useState({
    broadcastStart: true,
    broadcastReminders: true,
    newSchedule: false,
    systemUpdates: true,
  });

  // Sync local state with context preferences
  useEffect(() => {
    if (preferences) {
      setNotifications(prev => ({ ...prev, ...preferences }));
    }
  }, [preferences]);

  useEffect(() => {
    if (currentUser) {
      fetchMyAppeals();
    }
  }, [currentUser]);

  const fetchMyAppeals = async () => {
    setAppealsLoading(true);
    try {
      const data = await appealService.getMyAppeals();
      setMyAppeals(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error fetching appeals:', e);
    } finally {
      setAppealsLoading(false);
    }
  };

  const handleAppealSubmit = async (e) => {
    e.preventDefault();
    if (!newAppealReason.trim()) return;
    setAppealSubmitting(true);
    try {
      await appealService.createAppeal(newAppealReason);
      setNewAppealReason('');
      setPasswordMessage({ type: 'success', text: 'Appeal submitted successfully!' });
      setShowModal(true);
      fetchMyAppeals();
    } catch (error) {
      setPasswordMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to submit appeal. You may already have a pending appeal.'
      });
      setShowModal(true);
    } finally {
      setAppealSubmitting(false);
    }
  };

  // Auto-dismiss modal after 2 seconds
  useEffect(() => {
    if (showModal) {
      const timer = setTimeout(() => {
        setShowModal(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [showModal]);

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData({
      ...passwordData,
      [name]: value,
    });
  };

  const handleNotificationToggle = (key) => {
    setNotifications({
      ...notifications,
      [key]: !notifications[key],
    });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMessage({ type: '', text: '' });

    // Validate passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match!' });
      setShowModal(true);
      return;
    }

    // Validate password length
    if (passwordData.newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters long' });
      setShowModal(true);
      return;
    }

    try {
      // Only update if we have a currentUser and an ID
      if (currentUser && currentUser.id) {
        await changePassword(currentUser.id, {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        });

        setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
        setShowModal(true);

        // Clear form
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        setPasswordMessage({ type: 'error', text: 'User information not available. Please try again later.' });
        setShowModal(true);
      }
    } catch (error) {
      setPasswordMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to change password. Please verify your current password is correct.'
      });
      setShowModal(true);
    }
  };

  const handleNotificationsSubmit = (e) => {
    e.preventDefault();
    logger.info('Notification settings submitted:', notifications);
    updatePreferences(notifications);
    setPasswordMessage({ type: 'success', text: 'Notification preferences updated successfully!' });
    setShowModal(true);
  };

  return (
    <div className="container mx-auto px-4">
      {/* Password Change Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="fixed inset-0 bg-black opacity-50"></div>
          <div className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full transform transition-all ${
            passwordMessage.type === 'success' 
              ? 'border-l-4 border-green-500' 
              : 'border-l-4 border-red-500'
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-lg font-medium ${
                passwordMessage.type === 'success' 
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {passwordMessage.type === 'success' ? 'Success' : 'Error'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="text-gray-700 dark:text-gray-300">
              {passwordMessage.text}
            </p>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Settings</h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
          <div className="p-6">
            <form onSubmit={handlePasswordSubmit}>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700 flex items-center">
                <KeyIcon className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
                Change Password
              </h3>

              <div className="space-y-4 mb-6">
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    name="currentPassword"
                    id="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    name="newPassword"
                    id="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    id="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                    loading ? 'bg-maroon-400 cursor-not-allowed' : 'bg-maroon-700 hover:bg-maroon-800'
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-600`}
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
          <div className="p-6">
            <form onSubmit={handleNotificationsSubmit}>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700 flex items-center">
                <BellIcon className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
                Notification Preferences
              </h3>

              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">Broadcast Start Alerts</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Get notified when a broadcast goes live
                    </p>
                  </div>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      id="broadcastStart"
                      checked={notifications.broadcastStart}
                      onChange={() => handleNotificationToggle('broadcastStart')}
                      className="sr-only"
                    />
                    <label
                      htmlFor="broadcastStart"
                      className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                        notifications.broadcastStart ? 'bg-yellow-400' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span 
                        className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform ${
                          notifications.broadcastStart ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      ></span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">Broadcast Reminders</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Get reminders before scheduled broadcasts
                    </p>
                  </div>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      id="broadcastReminders"
                      checked={notifications.broadcastReminders}
                      onChange={() => handleNotificationToggle('broadcastReminders')}
                      className="sr-only"
                    />
                    <label
                      htmlFor="broadcastReminders"
                      className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                        notifications.broadcastReminders ? 'bg-yellow-400' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span 
                        className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform ${
                          notifications.broadcastReminders ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      ></span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">New Schedule Updates</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Get notified when new broadcasts are scheduled
                    </p>
                  </div>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      id="newSchedule"
                      checked={notifications.newSchedule}
                      onChange={() => handleNotificationToggle('newSchedule')}
                      className="sr-only"
                    />
                    <label
                      htmlFor="newSchedule"
                      className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                        notifications.newSchedule ? 'bg-yellow-400' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span 
                        className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform ${
                          notifications.newSchedule ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      ></span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">System Updates</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Receive notifications about system updates and maintenance
                    </p>
                  </div>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      id="systemUpdates"
                      checked={notifications.systemUpdates}
                      onChange={() => handleNotificationToggle('systemUpdates')}
                      className="sr-only"
                    />
                    <label
                      htmlFor="systemUpdates"
                      className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                        notifications.systemUpdates ? 'bg-yellow-400' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span 
                        className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform ${
                          notifications.systemUpdates ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      ></span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-maroon-700 hover:bg-maroon-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-600"
                >
                  Save Preferences
                </button>
              </div>
            </form>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700 flex items-center">
              <DocumentMagnifyingGlassIcon className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
              My Appeals
            </h3>
            
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Submit New Appeal</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                If you have been banned or received a strike you believe is unfair, you can submit an appeal here.
              </p>
              <form onSubmit={handleAppealSubmit}>
                <textarea
                  value={newAppealReason}
                  onChange={(e) => setNewAppealReason(e.target.value)}
                  placeholder="Explain why the strike/ban should be removed..."
                  className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white mb-2"
                  rows="3"
                  required
                />
                <div className="text-right">
                  <button 
                    type="submit" 
                    disabled={appealSubmitting}
                    className={`px-4 py-2 rounded text-white text-sm ${appealSubmitting ? 'bg-gray-400' : 'bg-maroon-700 hover:bg-maroon-800'}`}
                  >
                    {appealSubmitting ? 'Submitting...' : 'Submit Appeal'}
                  </button>
                </div>
              </form>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Appeal History</h4>
              {appealsLoading ? (
                <div className="text-sm text-gray-500">Loading appeals...</div>
              ) : myAppeals.length === 0 ? (
                <div className="text-sm text-gray-500 italic">No appeals found.</div>
              ) : (
                <div className="space-y-3">
                  {myAppeals.map(appeal => (
                    <div key={appeal.id} className="border dark:border-gray-700 rounded p-3 bg-gray-50 dark:bg-gray-900/50">
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          appeal.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          appeal.status === 'DENIED' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {appeal.status}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(appeal.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 dark:text-gray-200 mt-2">{appeal.reason}</p>
                      {appeal.decidedAt && (
                        <div className="mt-2 text-xs text-gray-500 border-t pt-2 dark:border-gray-700">
                          Decided on {new Date(appeal.decidedAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
} 
