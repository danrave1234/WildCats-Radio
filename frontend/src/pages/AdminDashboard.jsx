import { useState, useEffect } from 'react';
import { 
  UserGroupIcon, 
  RadioIcon, 
  UserIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { authService, broadcastService } from '../services/api';
import { Spinner } from '../components/ui/spinner';

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // State for editing user role
  const [editingUser, setEditingUser] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDJs: 0,
    totalListeners: 0,
    totalBroadcasts: 0,
    activeBroadcasts: 0,
    scheduledBroadcasts: 0
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    role: 'LISTENER',
    password: ''
  });

  // State for live broadcasts
  const [liveBroadcasts, setLiveBroadcasts] = useState([]);

  // Fetch users when component mounts
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  // Fetch live broadcasts and update stats
  useEffect(() => {
    const fetchLiveBroadcasts = async () => {
      try {
        // Fetch live broadcasts
        const response = await broadcastService.getLive();
        const broadcasts = response.data;
        setLiveBroadcasts(broadcasts);

        // Update stats
        setStats(prev => ({
          ...prev,
          activeBroadcasts: broadcasts.length
        }));

        // Fetch upcoming broadcasts to update scheduledBroadcasts count
        const upcomingResponse = await broadcastService.getUpcoming();
        const upcomingBroadcasts = upcomingResponse.data;

        setStats(prev => ({
          ...prev,
          scheduledBroadcasts: upcomingBroadcasts.length,
          totalBroadcasts: broadcasts.length + upcomingBroadcasts.length
        }));
      } catch (error) {
        console.error('Error fetching broadcasts:', error);
      }
    };

    // Fetch broadcasts when dashboard tab is active or every minute
    if (activeTab === 'dashboard' || activeTab === 'broadcasts') {
      fetchLiveBroadcasts();
      const interval = setInterval(fetchLiveBroadcasts, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Fetch users from the backend
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authService.getAllUsers();
      setUsers(response.data);

      // Update stats
      const djCount = response.data.filter(user => user.role === 'DJ').length;
      const listenerCount = response.data.filter(user => user.role === 'LISTENER').length;

      setStats(prev => ({
        ...prev,
        totalUsers: response.data.length,
        totalDJs: djCount,
        totalListeners: listenerCount
      }));
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to fetch users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Open role edit modal
  const handleEditRole = (user) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setShowRoleModal(true);
  };

  // Update user role
  const handleRoleUpdate = async () => {
    if (!editingUser || !selectedRole) return;

    setLoading(true);
    try {
      await authService.updateUserRole(editingUser.id, selectedRole);

      // Update local state
      setUsers(users.map(user => 
        user.id === editingUser.id ? { ...user, role: selectedRole } : user
      ));

      // Close modal
      setShowRoleModal(false);
      setEditingUser(null);

      // Update stats
      const updatedUsers = users.map(user => 
        user.id === editingUser.id ? { ...user, role: selectedRole } : user
      );
      const djCount = updatedUsers.filter(user => user.role === 'DJ').length;
      const listenerCount = updatedUsers.filter(user => user.role === 'LISTENER').length;

      setStats(prev => ({
        ...prev,
        totalDJs: djCount,
        totalListeners: listenerCount
      }));
    } catch (err) {
      console.error('Error updating user role:', err);
      setError('Failed to update user role. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle new user form changes
  const handleNewUserChange = (e) => {
    const { name, value } = e.target;
    setNewUser({
      ...newUser,
      [name]: value
    });
  };

  // Handle new user submission
  const handleNewUserSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Create user registration request
      const registerRequest = {
        name: newUser.username,
        email: newUser.email,
        password: newUser.password
      };

      // Register the user
      const response = await authService.register(registerRequest);
      const createdUser = response.data;

      // If the role is not LISTENER (default), update the role
      if (newUser.role !== 'LISTENER') {
        await authService.updateUserRole(createdUser.id, newUser.role);
        createdUser.role = newUser.role;
      }

      // Update local state
      setUsers([...users, createdUser]);

      // Reset form
      setNewUser({
        username: '',
        email: '',
        role: 'LISTENER',
        password: ''
      });

      // Update stats
      setStats(prev => ({
        ...prev,
        totalUsers: prev.totalUsers + 1,
        totalDJs: newUser.role === 'DJ' ? prev.totalDJs + 1 : prev.totalDJs,
        totalListeners: newUser.role === 'LISTENER' ? prev.totalListeners + 1 : prev.totalListeners
      }));

      alert('User created successfully!');
    } catch (err) {
      console.error('Error creating user:', err);
      setError('Failed to create user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle starting a broadcast
  const startBroadcast = async (broadcastId) => {
    try {
      await broadcastService.start(broadcastId);
      // Refresh the live broadcasts list
      fetchLiveBroadcasts();
      alert('Broadcast started successfully');
    } catch (error) {
      console.error('Error starting broadcast:', error);
      alert('There was an error starting the broadcast: ' + error.message);
    }
  };

  return (
    <div className="container mx-auto px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Admin Dashboard</h1>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="md:w-64 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                  <ShieldCheckIcon className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                  Admin Controls
                </h2>
              </div>
              <nav className="p-2">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`w-full text-left px-4 py-2 rounded-md flex items-center text-sm font-medium ${
                    activeTab === 'dashboard'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Admin Overview
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`w-full text-left px-4 py-2 rounded-md flex items-center text-sm font-medium ${
                    activeTab === 'users'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <UserGroupIcon className="h-5 w-5 mr-2" />
                  User Management
                </button>
                <button
                  onClick={() => setActiveTab('broadcasts')}
                  className={`w-full text-left px-4 py-2 rounded-md flex items-center text-sm font-medium ${
                    activeTab === 'broadcasts'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <RadioIcon className="h-5 w-5 mr-2" />
                  Broadcast Management
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              {activeTab === 'dashboard' && (
                <div className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">System Overview</h2>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-600 dark:text-blue-200">Total Users</p>
                          <p className="text-2xl font-semibold text-blue-800 dark:text-blue-100">{stats.totalUsers}</p>
                        </div>
                        <UserGroupIcon className="h-10 w-10 text-blue-500 dark:text-blue-300" />
                      </div>
                    </div>

                    <div className="bg-purple-50 dark:bg-purple-900 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-purple-600 dark:text-purple-200">Total DJs</p>
                          <p className="text-2xl font-semibold text-purple-800 dark:text-purple-100">{stats.totalDJs}</p>
                        </div>
                        <UserIcon className="h-10 w-10 text-purple-500 dark:text-purple-300" />
                      </div>
                    </div>

                    <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-600 dark:text-green-200">Total Broadcasts</p>
                          <p className="text-2xl font-semibold text-green-800 dark:text-green-100">{stats.totalBroadcasts}</p>
                        </div>
                        <RadioIcon className="h-10 w-10 text-green-500 dark:text-green-300" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">System Status</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Active Broadcasts</span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {stats.activeBroadcasts} Active
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Scheduled Broadcasts</span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {stats.scheduledBroadcasts} Scheduled
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'users' && (
                <div className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">User Management</h2>

                  {/* Create New User Form */}
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg mb-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Create New User</h3>
                    <form onSubmit={handleNewUserSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Username
                          </label>
                          <input
                            type="text"
                            id="username"
                            name="username"
                            value={newUser.username}
                            onChange={handleNewUserChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            id="email"
                            name="email"
                            value={newUser.email}
                            onChange={handleNewUserChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Password
                          </label>
                          <input
                            type="password"
                            id="password"
                            name="password"
                            value={newUser.password}
                            onChange={handleNewUserChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Role
                          </label>
                          <select
                            id="role"
                            name="role"
                            value={newUser.role}
                            onChange={handleNewUserChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                          >
                            <option value="LISTENER">Listener</option>
                            <option value="DJ">DJ</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Create User
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* User Table */}
                  <div className="overflow-x-auto">
                    {error && (
                      <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg mb-6">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                              <p>{error}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {loading ? (
                      <div className="flex flex-col justify-center items-center py-10 gap-4">
                        <Spinner variant="primary" size="default" />
                        <span className="text-maroon-700 dark:text-maroon-300 font-medium">Loading users...</span>
                      </div>
                    ) : (
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                              ID
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                              Username
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                              Email
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                              Role
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {users.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                No users found
                              </td>
                            </tr>
                          ) : (
                            users.map((user) => (
                              <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                  {user.id}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                  {user.name || user.username}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                  {user.email}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    user.role === 'ADMIN' 
                                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                      : user.role === 'DJ'
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  }`}>
                                    {user.role}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                  <button 
                                    onClick={() => handleEditRole(user)}
                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200 mr-3"
                                  >
                                    Edit Role
                                  </button>
                                  <button className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-200">
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'broadcasts' && (
                <div className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Broadcast Management</h2>

                  {/* Live Broadcasts Section */}
                  <div className="mb-8">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                      <span className="inline-flex items-center mr-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        <span className="h-2 w-2 rounded-full bg-red-500 mr-1 animate-pulse"></span>
                        LIVE
                      </span>
                      Currently Live Broadcasts
                    </h3>

                    {liveBroadcasts.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {liveBroadcasts.map(broadcast => (
                          <div key={broadcast.id} className="bg-white dark:bg-gray-700 shadow rounded-lg p-4 border-l-4 border-red-500">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-md font-medium text-gray-900 dark:text-white">{broadcast.title}</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  DJ: {broadcast.createdBy?.name || 'Unknown DJ'}
                                </p>
                                {broadcast.actualStart && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Started: {new Date(broadcast.actualStart).toLocaleString()}
                                  </p>
                                )}
                                {broadcast.description && (
                                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                                    {broadcast.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                  <span className="h-2 w-2 rounded-full bg-red-500 mr-1 animate-pulse"></span>
                                  LIVE
                                </span>
                                <div className="mt-2 flex flex-col space-y-2">
                                  <button 
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                    onClick={() => window.open(broadcast.streamUrl, '_blank')}
                                    disabled={!broadcast.streamUrl}
                                  >
                                    {broadcast.streamUrl ? 'Open Stream' : 'No Stream URL'}
                                  </button>
                                  <button 
                                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                                    onClick={() => startBroadcast(broadcast.id)}
                                  >
                                    Start Broadcast
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                        <p className="text-gray-500 dark:text-gray-400">No broadcasts are currently live</p>
                      </div>
                    )}
                  </div>

                  {/* Scheduled Broadcasts Section */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Scheduled Broadcasts</h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      View and manage upcoming scheduled broadcasts. You can also create new broadcast schedules.
                    </p>

                    {/* This would be replaced with actual scheduled broadcasts data */}
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                      <p className="text-gray-500 dark:text-gray-400">No scheduled broadcasts found</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Role Edit Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="relative mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3 text-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                Update User Role
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Change role for user: {editingUser?.name || editingUser?.email}
                </p>

                <div className="mb-4">
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">
                    Role
                  </label>
                  <select
                    id="role"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                  >
                    <option value="LISTENER">Listener</option>
                    <option value="DJ">DJ</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                {error && (
                  <div className="mb-4 text-sm text-red-600 dark:text-red-400">
                    {error}
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-3 px-4 py-3 bg-gray-50 dark:bg-gray-700 text-right sm:px-6 rounded-b-md">
                <button
                  onClick={() => {
                    setShowRoleModal(false);
                    setEditingUser(null);
                    setError(null);
                  }}
                  className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white dark:border-gray-500 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRoleUpdate}
                  disabled={loading}
                  className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {loading ? 'Updating...' : 'Update Role'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard; 
