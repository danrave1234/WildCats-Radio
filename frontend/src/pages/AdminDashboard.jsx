import { useState, useEffect } from 'react';
import { 
  UserGroupIcon, 
  RadioIcon, 
  CalendarIcon,
  UserIcon,
  ShieldCheckIcon,
  ServerIcon
} from '@heroicons/react/24/outline';
import { authService, broadcastService, serverService, streamService } from '../services/api';

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

  // Server schedule state
  const [serverSchedules, setServerSchedules] = useState([]);
  const [newSchedule, setNewSchedule] = useState({
    dayOfWeek: 'MONDAY',
    scheduledStart: '',
    scheduledEnd: '',
    automatic: true
  });
  const [serverRunning, setServerRunning] = useState(false);
  const [selectedDay, setSelectedDay] = useState('MONDAY');
  
  // ShoutCast diagnostics state
  const [shoutcastDiagnostics, setShoutcastDiagnostics] = useState(null);
  const [shoutcastError, setShoutcastError] = useState(null);
  const [shoutcastRefreshing, setShoutcastRefreshing] = useState(false);

  // Fetch users when component mounts
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  // Fetch ShoutCast diagnostics when the tab is active
  useEffect(() => {
    if (activeTab === 'shoutcast') {
      fetchShoutcastDiagnostics();
      
      // Set up interval to refresh diagnostics every 10 seconds
      const interval = setInterval(fetchShoutcastDiagnostics, 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Fetch ShoutCast diagnostics from the backend
  const fetchShoutcastDiagnostics = async () => {
    try {
      setShoutcastRefreshing(true);
      setShoutcastError(null);
      
      const response = await streamService.getDiagnostics();
      setShoutcastDiagnostics(response.data);
      
      // Update stats
      setStats(prev => ({
        ...prev,
        shoutcastStatus: response.data?.status || 'Unknown'
      }));
    } catch (error) {
      console.error('Error fetching ShoutCast diagnostics:', error);
      setShoutcastError('Failed to fetch ShoutCast server diagnostics');
    } finally {
      setShoutcastRefreshing(false);
    }
  };
  
  // Launch ShoutCast server if it's not running
  const handleLaunchShoutcastServer = async () => {
    try {
      setShoutcastRefreshing(true);
      setShoutcastError(null);
      
      const response = await streamService.launchServer();
      
      if (response.data.success) {
        // Wait a moment for the server to start up
        setTimeout(fetchShoutcastDiagnostics, 2000);
      } else {
        setShoutcastError(`Failed to launch ShoutCast server: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Error launching ShoutCast server:', error);
      setShoutcastError('Failed to launch ShoutCast server');
    } finally {
      setShoutcastRefreshing(false);
    }
  };

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

  // Fetch server schedules and check server status
  useEffect(() => {
    const fetchServerSchedules = async () => {
      try {
        const schedulesResponse = await serverService.getSchedules();
        setServerSchedules(schedulesResponse.data);

        const statusResponse = await serverService.getStatus();
        setServerRunning(statusResponse.data);

        // Update server status in stats
        setStats(prev => ({
          ...prev,
          serverStatus: statusResponse.data ? 'Online' : 'Offline'
        }));
      } catch (error) {
        console.error('Error fetching server schedules:', error);
      }
    };

    // Fetch schedules when schedule tab is active or dashboard tab is active
    if (activeTab === 'schedule' || activeTab === 'dashboard') {
      fetchServerSchedules();

      // Refresh server status every 30 seconds
      const interval = setInterval(async () => {
        try {
          const statusResponse = await serverService.getStatus();
          setServerRunning(statusResponse.data);

          // Update server status in stats
          setStats(prev => ({
            ...prev,
            serverStatus: statusResponse.data ? 'Online' : 'Offline'
          }));
        } catch (error) {
          console.error('Error checking server status:', error);
        }
      }, 30000);

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

  // Handle form changes for new schedule
  const handleNewScheduleChange = (e) => {
    const { name, value } = e.target;
    setNewSchedule(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle day selection change
  const handleDayChange = (e) => {
    setSelectedDay(e.target.value);

    // Update new schedule with selected day
    setNewSchedule(prev => ({
      ...prev,
      dayOfWeek: e.target.value
    }));
  };

  // Handle automatic toggle
  const handleAutomaticToggle = (e) => {
    setNewSchedule({
      ...newSchedule,
      automatic: true
    });
  };

  // Handle server start/stop
  const toggleServer = async () => {
    try {
      if (serverRunning) {
        // Stop the server
        await serverService.stopNow();
        setServerRunning(false);
        console.log('Stopping server');

        // Update stats
        setStats(prev => ({
          ...prev,
          serverStatus: 'Offline'
        }));
      } else {
        // Start the server
        await serverService.startNow();
        setServerRunning(true);
        console.log('Starting server');

        // Update stats
        setStats(prev => ({
          ...prev,
          serverStatus: 'Online'
        }));
      }
    } catch (error) {
      console.error('Error toggling server:', error);
      alert('There was an error controlling the server. Please try again.');
    }
  };

  // Handle server schedule submission
  const handleServerScheduleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Validate the form
      if (!newSchedule.scheduledStart || !newSchedule.scheduledEnd) {
        alert('Please enter both start and end times');
        return;
      }

      // Check if we're updating an existing schedule for this day
      const existingSchedule = serverSchedules.find(
        schedule => schedule.dayOfWeek === newSchedule.dayOfWeek
      );

      if (existingSchedule) {
        // Update existing schedule
        const updatedSchedule = {
          ...existingSchedule,
          scheduledStart: newSchedule.scheduledStart,
          scheduledEnd: newSchedule.scheduledEnd,
          automatic: newSchedule.automatic
        };

        await serverService.updateSchedule(existingSchedule.id, updatedSchedule);

        // Update local state
        setServerSchedules(serverSchedules.map(schedule => 
          schedule.id === existingSchedule.id ? updatedSchedule : schedule
        ));

        console.log('Updated server schedule:', updatedSchedule);
        alert('Server schedule updated!');
      } else {
        // Create new schedule
        const response = await serverService.createSchedule({
          ...newSchedule,
          automatic: true
        });
        const createdSchedule = response.data;

        // Update local state
        setServerSchedules([...serverSchedules, createdSchedule]);

        console.log('Created server schedule:', createdSchedule);
        alert('Server schedule created!');
      }

      // Reset form
      setNewSchedule({
        dayOfWeek: selectedDay,
        scheduledStart: '',
        scheduledEnd: '',
        automatic: true
      });

    } catch (error) {
      console.error('Error saving server schedule:', error);
      alert('There was an error saving the schedule. Please try again.');
    }
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

  // Handle starting a test broadcast
  const startTestBroadcast = async (broadcastId) => {
    try {
      await broadcastService.startTest(broadcastId);
      // Refresh the live broadcasts list
      fetchLiveBroadcasts();
      alert('Test broadcast started successfully');
    } catch (error) {
      console.error('Error starting test broadcast:', error);
      alert('There was an error starting the test broadcast: ' + error.message);
    }
  };

  // ShoutCast Diagnostics Card for the dashboard
  const ShoutcastStatusCard = () => {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center">
          <ServerIcon className="h-10 w-10 text-maroon-500 dark:text-maroon-400" />
          <div className="ml-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">ShoutCast Server</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stats.shoutcastStatus === 'UP' ? 'Online' : 
               stats.shoutcastStatus === 'DOWN' ? 'Offline' : 
               stats.shoutcastStatus === 'ERROR' ? 'Error' : 'Unknown'}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={() => setActiveTab('shoutcast')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-maroon-600 hover:bg-maroon-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-500"
          >
            View Diagnostics
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Admin Dashboard</h1>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`py-2 px-4 ${activeTab === 'dashboard' ? 'border-b-2 border-maroon-500 text-maroon-600 dark:text-maroon-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
        >
          Admin Controls
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`py-2 px-4 ${activeTab === 'users' ? 'border-b-2 border-maroon-500 text-maroon-600 dark:text-maroon-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
        >
          Users
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`py-2 px-4 ${activeTab === 'schedule' ? 'border-b-2 border-maroon-500 text-maroon-600 dark:text-maroon-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
        >
          Server Schedule
        </button>
        <button
          onClick={() => setActiveTab('broadcasts')}
          className={`py-2 px-4 ${activeTab === 'broadcasts' ? 'border-b-2 border-maroon-500 text-maroon-600 dark:text-maroon-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
        >
          Live Broadcasts
        </button>
        <button
          onClick={() => setActiveTab('shoutcast')}
          className={`py-2 px-4 ${activeTab === 'shoutcast' ? 'border-b-2 border-maroon-500 text-maroon-600 dark:text-maroon-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
        >
          ShoutCast Server
        </button>
      </div>

      {/* Dashboard Content */}
      {activeTab === 'dashboard' && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Admin Overview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* User Stats */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <div className="flex items-center">
                <UserGroupIcon className="h-10 w-10 text-maroon-500 dark:text-maroon-400" />
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Users</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total: {stats.totalUsers}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">DJs</p>
                  <p className="text-lg font-semibold text-maroon-600 dark:text-maroon-400">{stats.totalDJs}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Listeners</p>
                  <p className="text-lg font-semibold text-maroon-600 dark:text-maroon-400">{stats.totalListeners}</p>
                </div>
              </div>
            </div>

            {/* Broadcast Stats */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <div className="flex items-center">
                <RadioIcon className="h-10 w-10 text-maroon-500 dark:text-maroon-400" />
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Broadcasts</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total: {stats.totalBroadcasts}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Live</p>
                  <p className="text-lg font-semibold text-maroon-600 dark:text-maroon-400">{stats.activeBroadcasts}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Scheduled</p>
                  <p className="text-lg font-semibold text-maroon-600 dark:text-maroon-400">{stats.scheduledBroadcasts}</p>
                </div>
              </div>
            </div>

            {/* Server Status */}
            <ShoutcastStatusCard />

            {/* ... keep existing dashboard content ... */}
          </div>
          
          {/* ... keep rest of dashboard content ... */}
        </div>
      )}

      {/* ... keep other tab content ... */}

      {/* ShoutCast Server Diagnostics Content */}
      {activeTab === 'shoutcast' && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">ShoutCast Server Diagnostics</h2>
          
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Server Status</h3>
              <div className="flex space-x-2">
                <button
                  onClick={fetchShoutcastDiagnostics}
                  disabled={shoutcastRefreshing}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed"
                >
                  {shoutcastRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
                {shoutcastDiagnostics?.status === 'DOWN' && (
                  <button
                    onClick={handleLaunchShoutcastServer}
                    disabled={shoutcastRefreshing}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300 disabled:cursor-not-allowed"
                  >
                    Launch Server
                  </button>
                )}
              </div>
            </div>
            
            {shoutcastError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                <strong className="font-bold">Error!</strong>
                <span className="block sm:inline"> {shoutcastError}</span>
              </div>
            )}
            
            {shoutcastDiagnostics ? (
              <div>
                <div className="flex items-center mb-4">
                  <div className={`h-4 w-4 rounded-full mr-2 ${
                    shoutcastDiagnostics.status === 'UP' ? 'bg-green-500' : 
                    shoutcastDiagnostics.status === 'DOWN' ? 'bg-red-500' : 
                    'bg-yellow-500'
                  }`}></div>
                  <span className="text-lg font-medium">
                    {shoutcastDiagnostics.status === 'UP' ? 'Server Online' : 
                     shoutcastDiagnostics.status === 'DOWN' ? 'Server Offline' : 
                     'Server Status Unknown'}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-2">Connection Details</h4>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Server URL:</dt>
                        <dd className="text-sm font-medium text-gray-900 dark:text-white">{shoutcastDiagnostics.url || 'N/A'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Port:</dt>
                        <dd className="text-sm font-medium text-gray-900 dark:text-white">{shoutcastDiagnostics.port || 'N/A'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Mount Point:</dt>
                        <dd className="text-sm font-medium text-gray-900 dark:text-white">{shoutcastDiagnostics.mountPoint || 'N/A'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Client URL:</dt>
                        <dd className="text-sm font-medium text-gray-900 dark:text-white break-all">
                          {shoutcastDiagnostics.clientConnectionUrl || 'N/A'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Admin URL:</dt>
                        <dd className="text-sm font-medium text-gray-900 dark:text-white break-all">
                          {shoutcastDiagnostics.adminUrl || 'N/A'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-2">Stream Details</h4>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Stream Active:</dt>
                        <dd className="text-sm font-medium text-gray-900 dark:text-white">
                          {shoutcastDiagnostics.streamActive === true ? 'Yes' : 
                           shoutcastDiagnostics.streamActive === false ? 'No' : 'Unknown'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Current Listeners:</dt>
                        <dd className="text-sm font-medium text-gray-900 dark:text-white">{shoutcastDiagnostics.listeners || '0'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Current Broadcast:</dt>
                        <dd className="text-sm font-medium text-gray-900 dark:text-white">{shoutcastDiagnostics.currentBroadcast || 'None'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Last Stream Start:</dt>
                        <dd className="text-sm font-medium text-gray-900 dark:text-white">
                          {shoutcastDiagnostics.lastStreamStart ? new Date(shoutcastDiagnostics.lastStreamStart).toLocaleString() : 'N/A'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Last Stream End:</dt>
                        <dd className="text-sm font-medium text-gray-900 dark:text-white">
                          {shoutcastDiagnostics.lastStreamEnd ? new Date(shoutcastDiagnostics.lastStreamEnd).toLocaleString() : 'N/A'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                  <h4 className="text-md font-medium text-gray-900 dark:text-white mb-2">Detailed Diagnostics</h4>
                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto">
                    <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {JSON.stringify(shoutcastDiagnostics, null, 2)}
                    </pre>
                  </div>
                </div>
                
                {shoutcastDiagnostics.liveBroadcast && (
                  <div className="mt-6 bg-maroon-50 dark:bg-maroon-900/30 p-4 rounded-md">
                    <h4 className="text-md font-medium text-maroon-800 dark:text-maroon-200 mb-2">Active Broadcast</h4>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-sm text-maroon-600 dark:text-maroon-300">Title:</dt>
                        <dd className="text-sm font-medium text-maroon-800 dark:text-maroon-200">{shoutcastDiagnostics.liveBroadcast.title}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-maroon-600 dark:text-maroon-300">DJ:</dt>
                        <dd className="text-sm font-medium text-maroon-800 dark:text-maroon-200">{shoutcastDiagnostics.liveBroadcast.dj}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-maroon-600 dark:text-maroon-300">Started:</dt>
                        <dd className="text-sm font-medium text-maroon-800 dark:text-maroon-200">
                          {new Date(shoutcastDiagnostics.liveBroadcast.startTime).toLocaleString()}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                {shoutcastRefreshing ? (
                  <p className="text-gray-500 dark:text-gray-400">Loading diagnostics...</p>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No ShoutCast diagnostics available</p>
                )}
              </div>
            )}
          </div>
          
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Connection Test</h3>
            
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Test connecting to the ShoutCast server directly in your browser. This can help diagnose connectivity issues.
            </p>
            
            <div className="flex space-x-4">
              <a 
                href={`http://${shoutcastDiagnostics?.url || 'localhost'}:${shoutcastDiagnostics?.port || '8000'}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-maroon-600 hover:bg-maroon-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-500"
              >
                Open Server Homepage
              </a>
              
              <a 
                href={`http://${shoutcastDiagnostics?.url || 'localhost'}:${shoutcastDiagnostics?.port || '8000'}${shoutcastDiagnostics?.mountPoint || '/stream'}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Test Stream URL
              </a>
              
              <a 
                href={`http://${shoutcastDiagnostics?.url || 'localhost'}:${shoutcastDiagnostics?.port || '8000'}/7.html`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Check Status Page
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ... keep other tab content and modals ... */}
    </div>
  );
}

export default AdminDashboard; 
