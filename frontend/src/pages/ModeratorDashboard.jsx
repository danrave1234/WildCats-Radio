import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { broadcastService, authService, profanityService, notificationService } from '../services/api/index.js';
import { Spinner } from '../components/ui/spinner';

const ModeratorDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('moderation');
  // Users state (moderator-managed)
  const [users, setUsers] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'LISTENER' });

  // Live broadcasts state
  const [liveBroadcasts, setLiveBroadcasts] = useState([]);
  const [loadingLive, setLoadingLive] = useState(false);

  // User moderation state
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState(null);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [error, setError] = useState(null);

  // Profanity management state
  const [profanityWords, setProfanityWords] = useState([]);
  const [newProfanity, setNewProfanity] = useState('');
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

  useEffect(() => {
    if (activeTab === 'live') {
      fetchLive();
    }
    if (activeTab === 'moderation') {
      setProfMsg(null);
      setProfLoading(true);
      profanityService.listWords()
        .then((data) => setProfanityWords(Array.isArray(data) ? data : []))
        .catch(() => {})
        .finally(() => setProfLoading(false));
      // Load users list for role management (moderator-visible, not showing admins only)
      setRolesLoading(true);
      authService.getUsersByRole('LISTENER')
        .then((r1)=>{
          const listeners = Array.isArray(r1.data) ? r1.data : [];
          return authService.getUsersByRole('DJ').then((r2)=>{
            const djs = Array.isArray(r2.data) ? r2.data : [];
            setUsers([...listeners, ...djs]);
          });
        })
        .catch(()=>setUsers([]))
        .finally(()=>setRolesLoading(false));
    }
  }, [activeTab]);

  const handleWatch = (broadcastId) => {
    if (!broadcastId) return;
    navigate(`/broadcast/${broadcastId}`);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchEmail || !searchEmail.includes('@')) {
      setError('Enter a valid email');
      return;
    }
    setError(null);
    setSearching(true);
    setFoundUser(null);
    try {
      const resp = await authService.getUserByEmail(searchEmail);
      setFoundUser(resp.data || null);
    } catch (e) {
      setFoundUser(null);
      setError('User not found or not permitted');
    } finally {
      setSearching(false);
    }
  };

  const handleBan = async (user) => {
    if (!user) return;
    const unit = (window.prompt('Ban duration unit (DAYS, WEEKS, YEARS, PERMANENT):', 'DAYS') || '').toUpperCase().trim();
    if (!unit) return;
    if (!['DAYS','WEEKS','YEARS','PERMANENT'].includes(unit)) { alert('Invalid unit'); return; }
    let amount = null;
    if (unit !== 'PERMANENT') {
      const amtStr = window.prompt(`Amount for ${unit.toLowerCase()}:`, '1');
      if (amtStr == null) return;
      const parsed = parseInt(amtStr, 10);
      if (!(parsed > 0)) { alert('Amount must be positive'); return; }
      amount = parsed;
    }
    const reason = window.prompt('Reason (optional):', '') || null;
    setModerationLoading(true);
    try {
      await authService.banUser(user.id, { unit, amount, reason });
      alert('User banned');
      // Refresh details
      const resp = await authService.getUserByEmail(user.email);
      setFoundUser(resp.data || null);
    } catch (e) {
      alert('Failed to ban user');
    } finally {
      setModerationLoading(false);
    }
  };

  const handleUnban = async (user) => {
    if (!user) return;
    setModerationLoading(true);
    try {
      await authService.unbanUser(user.id);
      alert('User unbanned');
      const resp = await authService.getUserByEmail(user.email);
      setFoundUser(resp.data || null);
    } catch (e) {
      alert('Failed to unban user');
    } finally {
      setModerationLoading(false);
    }
  };

  const handleNewUserChange = (e) => {
    const { name, value } = e.target;
    setNewUser(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setRolesLoading(true);
    try {
      const registerRequest = { name: newUser.username, email: newUser.email, password: newUser.password };
      const res = await authService.register(registerRequest);
      const created = res.data;
      // Moderators cannot create admins/moderators; set role if LISTENER or DJ
      if (newUser.role === 'DJ') {
        await authService.updateUserRoleByActor(created.id, 'DJ');
        created.role = 'DJ';
      }
      setUsers(prev => [...prev, created]);
      setNewUser({ username: '', email: '', password: '', role: 'LISTENER' });
      alert('User created');
    } catch (err) {
      alert('Failed to create user');
    } finally {
      setRolesLoading(false);
    }
  };

  const handleChangeRole = async (userId, currentRole, nextRole) => {
    if (nextRole === 'ADMIN' || nextRole === 'MODERATOR') { alert('Not permitted'); return; }
    try {
      setRolesLoading(true);
      await authService.updateUserRoleByActor(userId, nextRole);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: nextRole } : u));
    } catch (e) {
      alert('Failed to change role');
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
      const res = await profanityService.addWord(w);
      setProfanityWords((prev) => prev.includes(w.toLowerCase()) ? prev : [...prev, w.toLowerCase()]);
      setNewProfanity('');
      setProfMsg(res?.message || 'Added');
    } catch (err) {
      setProfMsg(err?.response?.data?.message || 'Failed to add');
    } finally {
      setProfLoading(false);
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
                  onClick={() => setActiveTab('overview')}
                  className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium ${activeTab==='overview' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`}
                >Overview</button>
                <button
                  onClick={() => setActiveTab('live')}
                  className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium ${activeTab==='live' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`}
                >Live Broadcasts</button>
                <button
                  onClick={() => setActiveTab('moderation')}
                  className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium ${activeTab==='moderation' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`}
                >Moderation Tools</button>
                <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full text-left px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                >Dashboard</button>
                <button
                  onClick={() => navigate('/schedule')}
                  className="w-full text-left px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                >Schedule</button>
                <button
                  onClick={() => navigate('/broadcast-history')}
                  className="w-full text-left px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                >Broadcast History</button>
                <button
                  onClick={() => navigate('/notifications')}
                  className="w-full text-left px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                >Notifications</button>
              </nav>
            </div>
          </div>

          {/* Main */}
          <div className="flex-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              {activeTab === 'overview' && (
                <div className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
                  <p className="text-gray-600 dark:text-gray-300">Use the tabs to monitor live broadcasts, manage user bans, add profanity words, create Listener/DJ users, and toggle roles between Listener and DJ. Moderators cannot assign or create Admin/Moderator roles.</p>
                </div>
              )}

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
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Find User by Email</h2>
                  <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                    <input value={searchEmail} onChange={e=>setSearchEmail(e.target.value)} placeholder="user@example.com" className="flex-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    <button type="submit" disabled={searching} className={`px-4 py-2 rounded-md text-white ${searching ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>{searching ? 'Searching...' : 'Search'}</button>
                  </form>
                  {error && <div className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</div>}
                  {foundUser && (
                    <div className="border rounded-lg p-4 dark:border-gray-700">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-gray-900 dark:text-white font-medium">{(foundUser.firstname||'') + ' ' + (foundUser.lastname||'')}</div>
                          <div className="text-gray-600 dark:text-gray-300 text-sm">{foundUser.email}</div>
                          <div className="text-xs mt-2">
                            <span className={`px-2 py-0.5 rounded-full ${foundUser.role==='ADMIN'?'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200':foundUser.role==='DJ'?'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200':'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>{foundUser.role}</span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          {foundUser.banned ? (
                            <div>
                              <div>Banned {foundUser.bannedUntil ? `until ${new Date(foundUser.bannedUntil).toLocaleString()}` : '(permanent)'}</div>
                              {foundUser.banReason && <div className="text-xs text-gray-500">Reason: {foundUser.banReason}</div>}
                            </div>
                          ) : (
                            <div>Not banned</div>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        {!foundUser.banned && foundUser.role !== 'ADMIN' && (
                          <button disabled={moderationLoading} onClick={()=>handleBan(foundUser)} className={`px-4 py-2 rounded-md text-white ${moderationLoading?'bg-gray-400':'bg-red-600 hover:bg-red-700'}`}>{moderationLoading?'Please wait...':'Ban User'}</button>
                        )}
                        {foundUser.banned && (
                          <button disabled={moderationLoading} onClick={()=>handleUnban(foundUser)} className={`px-4 py-2 rounded-md text-white ${moderationLoading?'bg-gray-400':'bg-green-600 hover:bg-green-700'}`}>{moderationLoading?'Please wait...':'Unban User'}</button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Create User (Listener or DJ)</h3>
                    <form onSubmit={handleCreateUser} className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input name="username" value={newUser.username} onChange={handleNewUserChange} placeholder="Username" className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                        <input type="email" name="email" value={newUser.email} onChange={handleNewUserChange} placeholder="Email" className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                        <input type="password" name="password" value={newUser.password} onChange={handleNewUserChange} placeholder="Password" className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
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
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Change Roles (Listeners/DJs)</h3>
                    {rolesLoading && users.length === 0 ? (
                      <div className="text-sm text-gray-500">Loading users...</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left">
                              <th className="p-2">ID</th>
                              <th className="p-2">Name</th>
                              <th className="p-2">Email</th>
                              <th className="p-2">Role</th>
                              <th className="p-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.map(u => (
                              <tr key={u.id} className="border-t">
                                <td className="p-2">{u.id}</td>
                                <td className="p-2">{(u.firstname||'') + ' ' + (u.lastname||'')}</td>
                                <td className="p-2">{u.email}</td>
                                <td className="p-2">{u.role}</td>
                                <td className="p-2">
                                  <button onClick={()=>handleChangeRole(u.id, u.role, u.role==='LISTENER'?'DJ':'LISTENER')} className="px-3 py-1 text-xs rounded bg-purple-600 text-white hover:bg-purple-700">Toggle DJ</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Profanity Dictionary</h3>
                    <form onSubmit={handleAddProfanity} className="flex gap-2 mb-3">
                      <input
                        value={newProfanity}
                        onChange={(e)=>setNewProfanity(e.target.value)}
                        placeholder="Add new word or phrase"
                        className="flex-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                      <button type="submit" disabled={profLoading} className={`px-4 py-2 rounded-md text-white ${profLoading?'bg-gray-400':'bg-maroon-600 hover:bg-maroon-700'}`}>{profLoading?'Adding...':'Add'}</button>
                    </form>
                    {profMsg && <div className="text-sm mb-2 text-gray-700 dark:text-gray-300">{profMsg}</div>}
                    <div className="max-h-40 overflow-auto border rounded p-2 bg-gray-50 dark:bg-gray-800">
                      {profLoading ? (
                        <div>Loading...</div>
                      ) : profanityWords.length === 0 ? (
                        <div className="text-sm text-gray-500">No custom words yet.</div>
                      ) : (
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {profanityWords.sort().map((w) => (
                            <li key={w}>{w}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Send System Notification</h3>
                    <form onSubmit={handleSendNotification} className="flex gap-2">
                      <select value={notifyType} onChange={(e)=>setNotifyType(e.target.value)} className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                        <option value="INFO">INFO</option>
                        <option value="ALERT">ALERT</option>
                        <option value="REMINDER">REMINDER</option>
                      </select>
                      <input value={notifyText} onChange={(e)=>setNotifyText(e.target.value)} placeholder="Message to all users" className="flex-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                      <button type="submit" disabled={notifyLoading} className={`px-4 py-2 rounded-md text-white ${notifyLoading?'bg-gray-400':'bg-blue-600 hover:bg-blue-700'}`}>{notifyLoading?'Sending...':'Send'}</button>
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

export default ModeratorDashboard;


