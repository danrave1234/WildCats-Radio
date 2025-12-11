import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { 
  UserGroupIcon, 
  RadioIcon, 
  UserIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  DocumentMagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { authService, broadcastService, analyticsService, logger, profanityService, appealService } from '../services/api/index.js';
import { Spinner } from '../components/ui/spinner';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';

const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;
  const isAdmin = !!currentUser && currentUser.role === 'ADMIN';
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

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
    firstname: '',
    lastname: '',
    email: '',
    role: 'LISTENER',
    password: '',
    birthdate: ''
  });

  // Profanity dictionary state
  const [profanityWords, setProfanityWords] = useState([]);
  const [newProfanity, setNewProfanity] = useState('');
  const [newTier, setNewTier] = useState(1);
  const [profLoading, setProfLoading] = useState(false);
  const [profMsg, setProfMsg] = useState(null);

  // State for appeals
  const [appeals, setAppeals] = useState([]);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [appealAction, setAppealAction] = useState({ id: null, type: null }); // type: 'APPROVE' | 'DENY'
  const [appealNotes, setAppealNotes] = useState('');

  // State for live broadcasts
  const [liveBroadcasts, setLiveBroadcasts] = useState([]);
  // Overview cache to avoid reloading when switching tabs
  const [overviewLoaded, setOverviewLoaded] = useState(false);
  const [overviewRefreshing, setOverviewRefreshing] = useState(false);
  const [overviewUpdatedAt, setOverviewUpdatedAt] = useState(null);

  // Fetch totals needed for admin overview (simple, efficient)
  const fetchTotals = async () => {
    try {
      setOverviewRefreshing(true);
      // Fetch users and broadcast stats in parallel (1 lightweight analytics call for broadcast totals)
      const [usersResp, broadcastStatsResp] = await Promise.all([
        authService.getUsersPaged(0, 1),
        analyticsService.getBroadcastStats()
      ]);

      // Users
      const pageData = usersResp.data || {};
      const totalUsers = typeof pageData.totalElements === 'number' ? pageData.totalElements : 0;
      // For lightweight overview, skip per-role counts to avoid heavy queries
      const totalDJs = 0;
      const totalListeners = 0;

      // Broadcasts from analytics (fast server-side counts)
      const b = broadcastStatsResp.data || {};
      const activeBroadcasts = typeof b.liveBroadcasts === 'number' ? b.liveBroadcasts : 0;
      const scheduledBroadcasts = typeof b.upcomingBroadcasts === 'number' ? b.upcomingBroadcasts : 0;
      const totalBroadcasts = typeof b.totalBroadcasts === 'number' ? b.totalBroadcasts : (activeBroadcasts + scheduledBroadcasts);

      setStats(prev => ({
        ...prev,
        totalUsers,
        totalDJs,
        totalListeners,
        activeBroadcasts,
        scheduledBroadcasts,
        totalBroadcasts
      }));
      setOverviewLoaded(true);
      setOverviewUpdatedAt(new Date());
    } catch (error) {
      console.error('Error fetching totals for admin dashboard:', error);
    } finally {
      setOverviewRefreshing(false);
    }
  };

  // Load live broadcasts list only when broadcasts tab is active
  const fetchLiveBroadcasts = async () => {
    try {
      const resp = await broadcastService.getLive();
      setLiveBroadcasts(resp.data || []);
    } catch (e) {
      console.error('Error fetching live broadcasts:', e);
      setLiveBroadcasts([]);
    }
  };

  const fetchProfanity = async () => {
    setProfMsg(null);
    setProfLoading(true);
    try {
      const data = await profanityService.listWords();
      setProfanityWords(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error fetching profanity list:', e);
      setProfanityWords([]);
    } finally {
      setProfLoading(false);
    }
  };

  const fetchAppeals = async () => {
    setAppealsLoading(true);
    try {
      const data = await appealService.getPendingAppeals();
      setAppeals(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error fetching appeals:', e);
      setAppeals([]);
    } finally {
      setAppealsLoading(false);
    }
  };

  const handleResolveAppeal = async () => {
    if (!appealAction.id || !appealAction.type) return;
    try {
      // API expects 'APPROVED' or 'DENIED'
      const decision = appealAction.type === 'APPROVE' ? 'APPROVED' : 'DENIED';
      await appealService.resolveAppeal(appealAction.id, decision, appealNotes);
      // Refresh list
      await fetchAppeals();
      setAppealAction({ id: null, type: null });
      setAppealNotes('');
      alert(`Appeal ${decision.toLowerCase()} successfully.`);
    } catch (e) {
      console.error('Error resolving appeal:', e);
      alert('Failed to resolve appeal.');
    }
  };

  // Fetch users when component mounts or users tab active
  useEffect(() => {
    if (activeTab === 'users' && isAdmin) {
      fetchUsers();
    }
  }, [activeTab, page, isAdmin]);

  useEffect(() => {
    if (activeTab === 'appeals' && isAdmin) {
      fetchAppeals();
    }
  }, [activeTab, isAdmin]);

  // Fetch simple totals for overview once
  useEffect(() => {
    if (activeTab === 'dashboard' && !overviewLoaded && isAdmin) {
      fetchTotals();
    }
  }, [activeTab, overviewLoaded, isAdmin]);

  const refreshOverview = async () => {
    await fetchTotals();
  };

  // Fetch live list when broadcasts tab opens
  useEffect(() => {
    if (activeTab === 'broadcasts' && isAdmin) {
      fetchLiveBroadcasts();
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (activeTab === 'profanity' && isAdmin) {
      fetchProfanity();
    }
  }, [activeTab, isAdmin]);

  // Setup WebSocket for live broadcast updates
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;

    let liveBroadcastWs = null;

    const setupLiveBroadcastWebSocket = async () => {
      try {
        logger.debug('Setting up live broadcast WebSocket for admin dashboard');
        
        liveBroadcastWs = await broadcastService.subscribeToLiveBroadcastStatus((statusMessage) => {
          logger.debug('Received live broadcast update in admin dashboard:', statusMessage);
          
          // Refresh minimal totals when status changes
          fetchTotals();
        });

        logger.debug('Live broadcast WebSocket connected successfully for admin dashboard');
      } catch (error) {
        logger.error('Failed to setup live broadcast WebSocket for admin dashboard:', error);
      }
    };

    setupLiveBroadcastWebSocket();

    return () => {
      if (liveBroadcastWs) {
        liveBroadcastWs.disconnect();
        logger.debug('Live broadcast WebSocket disconnected from admin dashboard');
      }
    };
  }, [isAuthenticated, isAdmin]);

  // Fetch users from the backend
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authService.getUsersPaged(page, pageSize, searchQuery, roleFilter);
      const data = response.data;
      const content = Array.isArray(data?.content) ? data.content : [];
      setUsers(content);
      setTotalPages(typeof data.totalPages === 'number' ? data.totalPages : 0);
      setTotalElements(typeof data.totalElements === 'number' ? data.totalElements : content.length);

      // Update stats based on this page only for table counts; overall totals come from analytics
      const djCount = content.filter(user => user.role === 'DJ').length;
      const listenerCount = content.filter(user => user.role === 'LISTENER').length;

      setStats(prev => ({
        ...prev,
        totalUsers: prev.totalUsers, // leave overall to analytics
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

    if (!window.confirm(`Are you sure you want to change role of user ${editingUser.email} from ${editingUser.role} to ${selectedRole}? This action cannot be undone.`)) {
      return;
    }

    if (!window.confirm(`Are you sure you want to change role of user ${editingUser.email} from ${editingUser.role} to ${selectedRole}?`)) {
      return;
    }

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
      setError(null); // Clear any previous error

      // Update stats
      // This part is problematic as it's trying to update stats from a partial view.
      // A more robust solution would be to refetch overall user counts or update more carefully.
      // For now, let's keep it simple by just updating the local users array role.
      // The overall stats (totalDJs, totalListeners) are derived from the users array anyway.
      const updatedUsers = users.map(user => 
        user.id === editingUser.id ? { ...user, role: selectedRole } : user
      );
      const djCount = updatedUsers.filter(user => user.role === 'DJ').length;
      const listenerCount = updatedUsers.filter(user => user.role === 'LISTENER').length;

      setStats(prev => ({
        ...prev,
        // totalUsers: prev.totalUsers, // leave overall to analytics
        totalDJs: djCount,
        totalListeners: listenerCount
      }));
      alert('User role updated successfully!');
    } catch (err) {
      console.error('Error updating user role:', err);
      setError(err.response?.data?.error || err.message || 'Failed to update user role. Please verify permissions.');
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
        firstname: newUser.firstname,
        lastname: newUser.lastname,
        email: newUser.email,
        password: newUser.password,
        birthdate: newUser.birthdate
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
        firstname: '',
        lastname: '',
        email: '',
        role: 'LISTENER',
        password: '',
        birthdate: ''
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

  const handleAddProfanity = async (e) => {
    e.preventDefault();
    setProfMsg(null);
    const w = (newProfanity || '').trim();
    if (!w) return;
    try {
      setProfLoading(true);
      const res = await profanityService.addWord(w, parseInt(newTier));
      setProfanityWords((prev) => {
        const filtered = prev.filter(pw => pw.word !== w.toLowerCase());
        return [...filtered, res];
      });
      setNewProfanity('');
      setProfMsg(`Added ${w}`);
    } catch (err) {
      setProfMsg(err?.response?.data?.message || 'Failed to add word');
    } finally {
      setProfLoading(false);
    }
  };

  const handleDeleteWord = async (id) => {
    if (!window.confirm('Remove this word?')) return;
    try {
      await profanityService.deleteWord(id);
      setProfanityWords(prev => prev.filter(w => w.id !== id));
    } catch (err) {
      setProfMsg('Failed to delete word');
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
    isAdmin ? (
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
                <button
                  onClick={() => setActiveTab('profanity')}
                  className={`w-full text-left px-4 py-2 rounded-md flex items-center text-sm font-medium ${
                    activeTab === 'profanity'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <ShieldCheckIcon className="h-5 w-5 mr-2" />
                  Profanity Dictionary
                </button>
                <button
                  onClick={() => setActiveTab('appeals')}
                  className={`w-full text-left px-4 py-2 rounded-md flex items-center text-sm font-medium ${
                    activeTab === 'appeals'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <DocumentMagnifyingGlassIcon className="h-5 w-5 mr-2" />
                  Appeals
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              {activeTab === 'dashboard' && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">System Overview</h2>
                    <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                      {overviewUpdatedAt && (
                        <span>Last updated: {new Date(overviewUpdatedAt).toLocaleTimeString()}</span>
                      )}
                      <button
                        onClick={refreshOverview}
                        disabled={overviewRefreshing}
                        className="inline-flex items-center px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ArrowPathIcon className={`h-4 w-4 mr-1 ${overviewRefreshing ? 'animate-spin' : ''}`} />
                        {overviewRefreshing ? 'Refreshing…' : 'Refresh'}
                      </button>
                    </div>
                  </div>

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
                          <label htmlFor="firstname" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            First Name
                          </label>
                          <input
                            type="text"
                            id="firstname"
                            name="firstname"
                            value={newUser.firstname}
                            onChange={handleNewUserChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="lastname" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Last Name
                          </label>
                          <input
                            type="text"
                            id="lastname"
                            name="lastname"
                            value={newUser.lastname}
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
                            <option value="MODERATOR">Moderator</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="birthdate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Birthdate
                          </label>
                          <input
                            type="date"
                            id="birthdate"
                            name="birthdate"
                            value={newUser.birthdate}
                            onChange={handleNewUserChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                            required
                          />
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

                                    {/* User Management Search and Filter */}

                                    <div className="mb-4 flex flex-col sm:flex-row gap-2">

                                      <div className="relative flex-1">

                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">

                                          <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">

                                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />

                                          </svg>

                                        </div>

                                        <input

                                          type="text"

                                          placeholder="Search users by name or email..."

                                          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"

                                          value={searchQuery}

                                          onChange={(e) => setSearchQuery(e.target.value)}

                                          onKeyDown={(e) => {

                                            if (e.key === 'Enter') {

                                              setPage(0);

                                              fetchUsers();

                                            }

                                          }}

                                        />

                                      </div>

                                      <select

                                        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"

                                        value={roleFilter}

                                        onChange={(e) => {

                                          setRoleFilter(e.target.value);

                                          setPage(0); // Reset page when filter changes

                                        }}

                                      >

                                        <option value="ALL">All Roles</option>

                                        <option value="ADMIN">Admin</option>

                                        <option value="MODERATOR">Moderator</option>

                                        <option value="DJ">DJ</option>

                                        <option value="LISTENER">Listener</option>

                                      </select>

                                      <button

                                        onClick={() => {

                                          setPage(0);

                                          fetchUsers();

                                        }}

                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"

                                      >

                                        Filter/Search

                                      </button>

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

                                                Name

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

                                                <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">

                                                  No users found

                                                </td>

                                              </tr>

                                            ) : (

                                              users.map((user) => (

                                                <tr key={user.id}>

                                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">

                                                    {[user.firstname, user.lastname].filter(Boolean).join(' ') || user.email}

                                                  </td>

                                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">

                                                    {user.email}

                                                  </td>

                                                  <td className="px-6 py-4 whitespace-nowrap">

                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : user.role === 'MODERATOR' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' : user.role === 'DJ' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>

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

                                    {/* Pagination Controls */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {totalElements > 0 ? (
                        `Showing ${page * pageSize + 1} to ${Math.min((page + 1) * pageSize, totalElements)} of ${totalElements} users`
                      ) : (
                        'No users to display'
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0 || loading}
                        className={`px-3 py-1 rounded-md text-sm ${page === 0 || loading ? 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed' : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-500'}`}
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPage((p) => (totalPages && p < totalPages - 1 ? p + 1 : p))}
                        disabled={loading || !totalPages || page >= totalPages - 1}
                        className={`px-3 py-1 rounded-md text-sm ${loading || !totalPages || page >= totalPages - 1 ? 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed' : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-500'}`}
                      >
                        Next
                      </button>
                    </div>
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

              {activeTab === 'profanity' && (
                <div className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Profanity Dictionary</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Admin-only management of keyword tiers used by automated moderation. Tier 1 = censor only, Tier 2 = warn (Strike 1), Tier 3 = escalate to Strike 2/3.
                  </p>
                  <form onSubmit={handleAddProfanity} className="flex gap-2 mb-4 items-end">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 dark:text-gray-400">Word or phrase</label>
                      <input
                        value={newProfanity}
                        onChange={(e)=>setNewProfanity(e.target.value)}
                        placeholder="Add new word or phrase"
                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                    <div className="w-32">
                      <label className="text-xs text-gray-500 dark:text-gray-400">Tier</label>
                      <select 
                        value={newTier} 
                        onChange={(e)=>setNewTier(e.target.value)}
                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option value={1}>1 (Soft)</option>
                        <option value={2}>2 (Harsh)</option>
                        <option value={3}>3 (Slur)</option>
                      </select>
                    </div>
                    <button type="submit" disabled={profLoading} className={`px-4 py-2 rounded-md text-white h-10 ${profLoading?'bg-gray-400':'bg-maroon-600 hover:bg-maroon-700'}`}>{profLoading?'Adding...':'Add'}</button>
                  </form>
                  {profMsg && <div className="text-sm mb-2 text-gray-700 dark:text-gray-300">{profMsg}</div>}
                  <div className="max-h-80 overflow-auto border rounded p-2 bg-gray-50 dark:bg-gray-800">
                    {profanityWords.map((pw, i) => (
                      <span key={pw.id || i} className={`inline-block px-2 py-1 m-1 rounded text-sm ${
                        pw.tier===3 ? 'bg-red-200 text-red-900' : 
                        pw.tier===2 ? 'bg-orange-200 text-orange-900' : 
                        'bg-yellow-200 text-yellow-900'
                      }`}>
                        {pw.word} <span className="text-xs opacity-75">(T{pw.tier})</span>
                        {pw.id && (
                          <button 
                            onClick={() => handleDeleteWord(pw.id)} 
                            className="ml-2 text-xs font-bold text-gray-700 hover:text-red-600"
                            title="Delete"
                          >×</button>
                        )}
                      </span>
                    ))}
                    {profanityWords.length === 0 && <span className="text-gray-500 italic">No custom words found.</span>}
                  </div>

                  {/* Friendly rules helper (kept concise, responsive) */}
                  <div className="mt-6 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 space-y-3">
                    <h4 className="text-md font-semibold text-gray-900 dark:text-white">How tiers work</h4>
                    <div className="grid md:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yellow-200 text-yellow-900 text-xs font-bold">1</span>
                        <div>
                          <div className="font-semibold">Tier 1 — Soft</div>
                          <div>Censor only (replacement text). Logged for audit; no strike or mute.</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-200 text-orange-900 text-xs font-bold">2</span>
                        <div>
                          <div className="font-semibold">Tier 2 — Harsh</div>
                          <div>Censor + Strike 1 (warning). User gets a notice; shows in strike logs.</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-200 text-red-900 text-xs font-bold">3</span>
                        <div>
                          <div className="font-semibold">Tier 3 — Slurs/Hate</div>
                          <div>Censor + Strike 2 (24h ban). Repeat escalates to Strike 3 (7-day ban + appeal option).</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-200 text-blue-900 text-xs font-bold">i</span>
                        <div>
                          <div className="font-semibold">Good practice</div>
                          <ul className="list-disc list-inside space-y-1">
                            <li>Keep entries specific to avoid over-censoring.</li>
                            <li>Reserve Tier 3 for slurs/hate; use Tier 2 for harsh profanity.</li>
                            <li>Review high-severity entries regularly and trim false positives.</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'appeals' && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Pending Appeals</h2>
                    <button onClick={fetchAppeals} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">Refresh</button>
                  </div>
                  
                  {appealsLoading ? (
                    <div className="flex justify-center p-8"><Spinner /></div>
                  ) : appeals.length === 0 ? (
                    <div className="text-center p-8 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400">
                      No pending appeals.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {appeals.map(appeal => (
                        <div key={appeal.id} className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                Appeal from User #{appeal.userId}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(appeal.createdAt).toLocaleString()}
                              </div>
                            </div>
                            <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                              {appeal.status}
                            </span>
                          </div>
                          
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Reason:</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                              {appeal.reason}
                            </p>
                          </div>

                          <div className="mb-4">
                            <details className="text-sm text-gray-500 cursor-pointer">
                              <summary className="hover:text-gray-700 dark:hover:text-gray-300">View Strike History Snapshot</summary>
                              <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 text-xs overflow-auto rounded max-h-40">
                                {appeal.strikeHistory || 'No history recorded'}
                              </pre>
                            </details>
                          </div>

                          <div className="flex gap-2 justify-end pt-2 border-t dark:border-gray-700">
                            <button
                              onClick={() => setAppealAction({ id: appeal.id, type: 'DENY' })}
                              className="px-3 py-1 text-sm rounded border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                            >
                              Deny
                            </button>
                            <button
                              onClick={() => setAppealAction({ id: appeal.id, type: 'APPROVE' })}
                              className="px-3 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700"
                            >
                              Approve
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Appeal Action Modal */}
      {appealAction.id && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="relative mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {appealAction.type === 'APPROVE' ? 'Approve Appeal' : 'Deny Appeal'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {appealAction.type === 'APPROVE' 
                ? 'This will unban the user and resolve the appeal. Add optional notes below.'
                : 'This will keep the ban active. Add optional notes below.'}
            </p>
            <textarea
              className="w-full p-2 border rounded mb-4 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              rows="3"
              placeholder="Internal notes/reason..."
              value={appealNotes}
              onChange={(e) => setAppealNotes(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setAppealAction({ id: null, type: null }); setAppealNotes(''); }}
                className="px-4 py-2 rounded text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveAppeal}
                className={`px-4 py-2 rounded text-white ${appealAction.type === 'APPROVE' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                Confirm {appealAction.type === 'APPROVE' ? 'Approve' : 'Deny'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  Change role for user: {([editingUser?.firstname, editingUser?.lastname].filter(Boolean).join(' ') || editingUser?.email) }
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
                    <option value="MODERATOR">Moderator</option>
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
    ) : (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            You must be an Administrator to access this page.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your current role is: <span className="font-semibold">{currentUser?.role || 'Not Authenticated'}</span>
          </p>
        </div>
      </div>
    )
  );
};

export default AdminDashboard; 
