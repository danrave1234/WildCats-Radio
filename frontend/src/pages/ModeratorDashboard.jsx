import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { broadcastService, authService, profanityService, notificationService } from '../services/api/index.js';
import { Spinner } from '../components/ui/spinner';
import { useAuth } from '../context/AuthContext';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';

const ModeratorDashboardContent = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('moderation');
  
  // Users state with pagination
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newUser, setNewUser] = useState({ firstname: '', lastname: '', email: '', password: '', role: 'LISTENER', birthdate: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Live broadcasts state
  const [liveBroadcasts, setLiveBroadcasts] = useState([]);
  const [loadingLive, setLoadingLive] = useState(false);


  // Profanity management state
  const [profanityWords, setProfanityWords] = useState([]);
  const [newProfanity, setNewProfanity] = useState('');
  const [newTier, setNewTier] = useState(1);
  const [profLoading, setProfLoading] = useState(false);
  const [profMsg, setProfMsg] = useState(null);

  // Notification broadcast state
  const [notifyText, setNotifyText] = useState('');
  const [notifyType, setNotifyType] = useState('INFO');
  const [notifyLoading, setNotifyLoading] = useState(false);

  const fetchLive = async () => {
    setLoadingLive(true);
    try {
      const resp = await broadcastService.getLive();
      setLiveBroadcasts(Array.isArray(resp.data) ? resp.data : []);
    } catch (e) {
      setLiveBroadcasts([]);
    } finally {
      setLoadingLive(false);
    }
  };

  const fetchUsers = async () => {
    setRolesLoading(true);
    setError(null);
    try {
      const response = await authService.getUsersPaged(page, pageSize, searchQuery, roleFilter);
      const data = response.data;
      const content = Array.isArray(data?.content) ? data.content : [];
      
      // Moderators should not see or manage Admins
      const filteredContent = content.filter(user => user.role !== 'ADMIN');
      
      setUsers(filteredContent);
      setTotalPages(typeof data.totalPages === 'number' ? data.totalPages : 0);
      setTotalElements(typeof data.totalElements === 'number' ? data.totalElements : content.length);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to fetch users. Please try again.');
    } finally {
      setRolesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'live') {
      fetchLive();
    }
    if (activeTab === 'moderation') {
      fetchLive(); // Also fetch live broadcasts for moderator controls
      setProfMsg(null);
      setProfLoading(true);
      profanityService.listWords()
        .then((data) => setProfanityWords(Array.isArray(data) ? data : []))
        .catch(() => {})
        .finally(() => setProfLoading(false));

      fetchUsers();
    }
  }, [activeTab, page]);

  const handleWatch = (broadcastId) => {
    if (!broadcastId) return;
    navigate(`/broadcast/${broadcastId}`);
  };

  const handleNewUserChange = (e) => {
    const { name, value } = e.target;
    setNewUser(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setRolesLoading(true);
    try {
      const registerRequest = {
        firstname: newUser.firstname,
        lastname: newUser.lastname,
        email: newUser.email,
        password: newUser.password,
        birthdate: newUser.birthdate
      };
      const res = await authService.register(registerRequest);
      const created = res.data;
      // Set role if selected (Listener is default from backend)
      if (newUser.role === 'DJ' || newUser.role === 'MODERATOR') {
        await authService.updateUserRoleByActor(created.id, newUser.role);
        created.role = newUser.role;
      }
      setUsers(prev => [...prev, created]);
      setNewUser({ firstname: '', lastname: '', email: '', password: '', role: 'LISTENER', birthdate: '' });
      alert('User created');
    } catch (err) {
      alert('Failed to create user');
    } finally {
      setRolesLoading(false);
    }
  };

  // Update user role
  const handleRoleUpdate = async (userId, oldRole, newRole) => {
    if (newRole === oldRole) return; // No change

    const userEmail = users.find(u => u.id === userId)?.email || 'this user';
    if (!window.confirm(`Are you sure you want to change the role of user ${userEmail} from ${oldRole} to ${newRole}?`)) {
      return;
    }

    setRolesLoading(true);
    try {
      // Use updateUserRoleByActor as it's designed for actor-based role changes
      await authService.updateUserRoleByActor(userId, newRole); 

      // Update local state
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      alert('User role updated successfully!');
    } catch (e) {
      console.error('Error changing role:', e);
      alert(e.response?.data?.error || e.message || 'Failed to change role. Please verify permissions.');
    } finally {
      setRolesLoading(false);
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
      // res is the DTO
      setProfanityWords((prev) => {
        // If it was inactive, remove old one first or update it
        const filtered = prev.filter(pw => pw.word !== w.toLowerCase());
        return [...filtered, res];
      });
      setNewProfanity('');
      setProfMsg('Added ' + w);
    } catch (err) {
      setProfMsg(err?.response?.data?.message || 'Failed to add');
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
      alert('Failed to delete word');
    }
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    const msg = (notifyText || '').trim();
    if (!msg) return;
    try {
      setNotifyLoading(true);
      await notificationService.sendBroadcast(msg, notifyType);
      setNotifyText('');
      alert('Notification sent');
    } catch (err) {
      alert('Failed to send notification');
    } finally {
      setNotifyLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Moderator Dashboard</h1>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="md:w-64 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Moderator Controls</h2>
              </div>
              <nav className="p-2">
                <button
                  onClick={() => setActiveTab('moderation')}
                  className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium ${activeTab==='moderation' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`}
                >Moderator Controls</button>
                <button
                  onClick={() => setActiveTab('live')}
                  className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium ${activeTab==='live' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`}
                >Live Broadcasts</button>
                <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full text-left px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                >Dashboard</button>
              </nav>
            </div>
          </div>

          {/* Main */}
          <div className="flex-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              {activeTab === 'live' && (
                <div className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Currently Live Broadcasts</h2>
                  {loadingLive ? (
                    <div className="flex justify-center py-8"><Spinner variant="primary" size="default" /></div>
                  ) : liveBroadcasts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {liveBroadcasts.map(b => (
                        <div key={b.id} className="bg-white dark:bg-gray-700 shadow rounded-lg p-4 border-l-4 border-red-500">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-md font-medium text-gray-900 dark:text-white">{b.title}</h4>
                              {b.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{b.description}</p>}
                            </div>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              <span className="h-2 w-2 rounded-full bg-red-500 mr-1 animate-pulse"></span>
                              LIVE
                            </span>
                          </div>
                          <div className="mt-3 flex gap-3">
                            <button onClick={() => handleWatch(b.id)} className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">Watch</button>
                            {b.streamUrl && (
                              <a href={b.streamUrl} target="_blank" rel="noreferrer" className="text-sm px-3 py-1.5 rounded bg-purple-600 text-white hover:bg-purple-700">Open Stream</a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded text-center text-gray-600 dark:text-gray-300">No broadcasts are currently live</div>
                  )}
                </div>
              )}

              {activeTab === 'moderation' && (
                <div className="p-6">
                  {/* ... User Management Section ... */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Create User</h3>
                    <form onSubmit={handleCreateUser} className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input name="firstname" value={newUser.firstname} onChange={handleNewUserChange} placeholder="First name" className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                        <input name="lastname" value={newUser.lastname} onChange={handleNewUserChange} placeholder="Last name" className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                        <input type="email" name="email" value={newUser.email} onChange={handleNewUserChange} placeholder="Email" className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                        <input type="password" name="password" value={newUser.password} onChange={handleNewUserChange} placeholder="Password" className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                        <input type="date" name="birthdate" value={newUser.birthdate} onChange={handleNewUserChange} placeholder="Birthdate" className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                        <select name="role" value={newUser.role} onChange={handleNewUserChange} className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                          <option value="LISTENER">Listener</option>
                          <option value="DJ">DJ</option>
                        </select>
                      </div>
                      <div className="text-right">
                        <button type="submit" disabled={rolesLoading} className={`px-4 py-2 rounded-md text-white ${rolesLoading?'bg-gray-400':'bg-blue-600 hover:bg-blue-700'}`}>{rolesLoading?'Creating...':'Create'}</button>
                      </div>
                    </form>
                  </div>

                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Manage Users</h3>
                    {/* Search and Filter Users */}
                    <div className="mb-4 flex flex-col sm:flex-row gap-2">
                      <input 
                        type="text" 
                        placeholder="Search users by name or email..." 
                        className="flex-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setPage(0);
                            fetchUsers();
                          }
                        }}
                      />
                      <select
                        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        value={roleFilter}
                        onChange={(e) => {
                          setRoleFilter(e.target.value);
                          setPage(0); // Reset page when filter changes
                        }}
                      >
                        <option value="ALL">All Roles</option>
                        <option value="LISTENER">Listener</option>
                        <option value="DJ">DJ</option>
                        <option value="MODERATOR">Moderator</option>
                      </select>
                      <button 
                        onClick={() => {
                          setPage(0);
                          fetchUsers();
                        }} 
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Filter/Search
                      </button>
                    </div>

                    {rolesLoading && users.length === 0 ? (
                      <div className="text-sm text-gray-500">Loading users...</div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                              <tr className="text-left">
                                <th className="p-2">Name</th>
                                <th className="p-2">Email</th>
                                <th className="p-2">Role</th>
                                <th className="p-2">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {users.map(u => (
                                <tr key={u.id} className="border-t dark:border-gray-700">
                                  <td className="p-2">{(u.firstname||'') + ' ' + (u.lastname||'')}</td>
                                  <td className="p-2">{u.email}</td>
                                  <td className="p-2">{u.role}</td>
                                  <td className="p-2">
                                    <select
                                      value={u.role}
                                      onChange={(e) => handleRoleUpdate(u.id, u.role, e.target.value)}
                                      className="p-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs"
                                      disabled={rolesLoading || u.role === 'ADMIN' || u.role === 'MODERATOR'}
                                    >
                                      <option value="LISTENER">Listener</option>
                                      <option value="DJ">DJ</option>
                                    </select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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
                              disabled={page === 0 || rolesLoading}
                              className={`px-3 py-1 rounded-md text-sm ${page === 0 || rolesLoading ? 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed' : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-500'}`}
                            >
                              Previous
                            </button>
                            <button
                              onClick={() => setPage((p) => (totalPages && p < totalPages - 1 ? p + 1 : p))}
                              disabled={rolesLoading || !totalPages || page >= totalPages - 1}
                              className={`px-3 py-1 rounded-md text-sm ${rolesLoading || !totalPages || page >= totalPages - 1 ? 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed' : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-500'}`}
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Profanity Dictionary</h3>
                    <form onSubmit={handleAddProfanity} className="flex gap-2 mb-3 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 dark:text-gray-400">Word</label>
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
                    <div className="max-h-60 overflow-auto border rounded p-2 bg-gray-50 dark:bg-gray-800">
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
                  </div>

                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Broadcast Notification</h3>
                    <form onSubmit={handleSendNotification} className="space-y-3">
                      <div>
                        <select value={notifyType} onChange={(e)=>setNotifyType(e.target.value)} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white mb-2">
                          <option value="INFO">Info</option>
                          <option value="WARNING">Warning</option>
                          <option value="ALERT">Alert</option>
                        </select>
                        <textarea
                          value={notifyText}
                          onChange={(e)=>setNotifyText(e.target.value)}
                          placeholder="Type notification message..."
                          className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          rows="3"
                        />
                      </div>
                      <div className="text-right">
                        <button type="submit" disabled={notifyLoading} className={`px-4 py-2 rounded-md text-white ${notifyLoading?'bg-gray-400':'bg-red-600 hover:bg-red-700'}`}>{notifyLoading?'Sending...':'Send Broadcast'}</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModeratorDashboardContent;
