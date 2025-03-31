import { useState } from 'react';
import { 
  KeyIcon,
  BellIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

export default function Settings() {
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [notifications, setNotifications] = useState({
    broadcastStart: true,
    broadcastReminders: true,
    newSchedule: false,
    systemUpdates: true,
  });

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

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match!');
      return;
    }
    console.log('Password change submitted');
    // Here you would send the password change request to your backend
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    alert('Password changed successfully!');
  };

  const handleNotificationsSubmit = (e) => {
    e.preventDefault();
    console.log('Notification settings submitted:', notifications);
    // Here you would send the notification settings to your backend
    alert('Notification settings updated successfully!');
  };

  return (
    <div className="container mx-auto px-4">
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
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-maroon-700 hover:bg-maroon-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-600"
                >
                  Update Password
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
                      Receive reminders 15 minutes before scheduled broadcasts
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
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">New Schedule Notifications</h4>
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
      </div>
    </div>
  );
} 