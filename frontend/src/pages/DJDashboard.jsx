import { useState, useEffect } from 'react';
import { 
  PlayIcon, 
  StopIcon, 
  CalendarIcon,
  ClockIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  MicrophoneIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { broadcastService, serverService, pollService } from '../services/api';

export default function DJDashboard() {
  // Broadcast state
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [audioInputLevel, setAudioInputLevel] = useState(0);
  const [audioInputDevice, setAudioInputDevice] = useState('default');
  const [availableAudioDevices, setAvailableAudioDevices] = useState([]);
  const [currentBroadcastId, setCurrentBroadcastId] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [otherLiveBroadcasts, setOtherLiveBroadcasts] = useState([]);

  // Server schedule state
  const [serverSchedule, setServerSchedule] = useState({
    scheduledStart: '',
    scheduledEnd: '',
  });
  const [serverRunning, setServerRunning] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState({
    viewerCount: 0,
    peakViewers: 0,
    chatMessages: 0,
    songRequests: 0,
  });

  // Chat messages state
  const [chatMessages, setChatMessages] = useState([]);

  // Song requests state
  const [songRequests, setSongRequests] = useState([]);

  // Poll state
  const [polls, setPolls] = useState([]);
  const [newPoll, setNewPoll] = useState({
    question: '',
    options: ['', ''],
    broadcastId: null
  });
  const [pollResults, setPollResults] = useState({});
  const [activePoll, setActivePoll] = useState(null);

  // Check for audio input devices and fetch analytics
  useEffect(() => {
    // Should fetch available audio devices from the browser's API
    // For example: navigator.mediaDevices.enumerateDevices()

    // Audio level monitoring and analytics should be implemented with real data
    let interval;
    if (isBroadcasting || testMode) {
      interval = setInterval(() => {
        // Should get real audio input level
        // Should fetch real analytics data if broadcasting
        if (isBroadcasting) {
          // Simulate audio level changes for demo purposes
          setAudioInputLevel(Math.floor(Math.random() * 100));
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isBroadcasting, testMode]);

  // Fetch broadcasts and check for live broadcasts
  useEffect(() => {
    const fetchBroadcasts = async () => {
      try {
        // Fetch all broadcasts
        const response = await broadcastService.getAll();
        setBroadcasts(response.data);

        // Check for live broadcasts
        const liveResponse = await broadcastService.getLive();
        const liveBroadcasts = liveResponse.data;

        // Filter out broadcasts that belong to the current DJ
        // This assumes that each broadcast has a createdBy field with the DJ's info
        // You might need to adjust this based on your actual data structure
        const otherLive = liveBroadcasts.filter(broadcast => {
          // This is a placeholder condition - adjust based on how you identify the current user
          // For example, you might compare broadcast.createdBy.id with the current user's ID
          return !currentBroadcastId || broadcast.id !== currentBroadcastId;
        });

        setOtherLiveBroadcasts(otherLive);

        // Check if the current DJ has a live broadcast
        const myLiveBroadcast = liveBroadcasts.find(broadcast => {
          // This is a placeholder condition - adjust based on how you identify the current user
          return currentBroadcastId && broadcast.id === currentBroadcastId;
        });

        // Update broadcasting state based on whether the DJ has a live broadcast
        if (myLiveBroadcast) {
          setIsBroadcasting(true);
          setCurrentBroadcastId(myLiveBroadcast.id);
        }
      } catch (error) {
        console.error("Error fetching broadcasts:", error);
      }
    };

    fetchBroadcasts();

    // Set up interval to periodically check for live broadcasts
    const interval = setInterval(fetchBroadcasts, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [currentBroadcastId]);

  // Handle audio device change
  const handleAudioDeviceChange = (e) => {
    setAudioInputDevice(e.target.value);
  };

  // Handle form changes
  const handleServerScheduleChange = (e) => {
    const { name, value } = e.target;
    setServerSchedule(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle start/stop broadcast
  const toggleBroadcast = async () => {
    try {
      if (isBroadcasting && currentBroadcastId) {
        // End broadcast
        await broadcastService.end(currentBroadcastId);
        setIsBroadcasting(false);
        setTestMode(false);
        setCurrentBroadcastId(null);
        console.log('Ending broadcast');
      } else {
        // Check if server is running
        const serverStatusResponse = await serverService.getStatus();
        const isServerRunning = serverStatusResponse.data && serverStatusResponse.data.running;

        if (!isServerRunning) {
          alert('Server is not running. Please start the server before broadcasting.');
          return;
        }

        // Find a scheduled broadcast to start, or create a new one
        let broadcastToStart;

        // Look for a scheduled broadcast that hasn't started yet
        if (broadcasts.length > 0) {
          broadcastToStart = broadcasts.find(b => b.status === 'SCHEDULED');
        }

        if (broadcastToStart) {
          // Start an existing scheduled broadcast
          const response = await broadcastService.start(broadcastToStart.id);
          setCurrentBroadcastId(broadcastToStart.id);
        } else {
          // Create and start a new broadcast
          const newBroadcast = {
            title: 'Live Broadcast',
            description: 'Started from DJ Dashboard',
            scheduledStart: new Date().toISOString(),
            scheduledEnd: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
          };

          const scheduleResponse = await broadcastService.schedule(newBroadcast);
          const createdBroadcast = scheduleResponse.data;

          const startResponse = await broadcastService.start(createdBroadcast.id);
          setCurrentBroadcastId(createdBroadcast.id);
        }

        setIsBroadcasting(true);
        setTestMode(false);
        console.log('Starting broadcast');
        console.log('Using audio device:', audioInputDevice);
      }
    } catch (error) {
      console.error('Error toggling broadcast:', error);
      alert('There was an error with the broadcast. Please try again.');
    }
  };

  // Handle test broadcast
  const toggleTestMode = () => {
    if (testMode) {
      setTestMode(false);
    } else {
      setIsBroadcasting(false);
      setTestMode(true);
    }
  };

  // Handle server start/stop
  const toggleServer = () => {
    // In a real app, you would send a request to your backend to start/stop the server
    setServerRunning(!serverRunning);
    console.log(serverRunning ? 'Stopping server' : 'Starting server');
  };

  // Handle server schedule submission
  const handleServerScheduleSubmit = (e) => {
    e.preventDefault();
    // In a real app, you would send this to your backend
    console.log('Server schedule:', serverSchedule);
    alert('Server schedule updated!');
  };

  // Poll functions
  const fetchPolls = async () => {
    if (!currentBroadcastId) return;

    try {
      const response = await pollService.getPollsForBroadcast(currentBroadcastId);
      setPolls(response.data);

      // Check for active polls
      const activePolls = response.data.filter(poll => poll.active);
      if (activePolls.length > 0) {
        setActivePoll(activePolls[0]);
        fetchPollResults(activePolls[0].id);
      } else {
        setActivePoll(null);
      }
    } catch (error) {
      console.error('Error fetching polls:', error);
    }
  };

  const fetchPollResults = async (pollId) => {
    try {
      const response = await pollService.getPollResults(pollId);
      setPollResults(prev => ({
        ...prev,
        [pollId]: response.data
      }));
    } catch (error) {
      console.error('Error fetching poll results:', error);
    }
  };

  const handlePollChange = (e) => {
    const { name, value } = e.target;
    setNewPoll(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleOptionChange = (index, value) => {
    setNewPoll(prev => {
      const updatedOptions = [...prev.options];
      updatedOptions[index] = value;
      return {
        ...prev,
        options: updatedOptions
      };
    });
  };

  const addOption = () => {
    setNewPoll(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const removeOption = (index) => {
    if (newPoll.options.length <= 2) return; // Minimum 2 options

    setNewPoll(prev => {
      const updatedOptions = [...prev.options];
      updatedOptions.splice(index, 1);
      return {
        ...prev,
        options: updatedOptions
      };
    });
  };

  const createPoll = async (e) => {
    e.preventDefault();

    if (!currentBroadcastId) {
      alert('You must be broadcasting to create a poll');
      return;
    }

    // Validate poll data
    if (!newPoll.question.trim()) {
      alert('Please enter a question');
      return;
    }

    const validOptions = newPoll.options.filter(option => option.trim());
    if (validOptions.length < 2) {
      alert('Please enter at least 2 options');
      return;
    }

    try {
      const pollData = {
        question: newPoll.question,
        broadcastId: currentBroadcastId,
        options: validOptions
      };

      await pollService.createPoll(pollData);

      // Reset form
      setNewPoll({
        question: '',
        options: ['', ''],
        broadcastId: currentBroadcastId
      });

      // Fetch updated polls
      fetchPolls();

      alert('Poll created successfully!');
    } catch (error) {
      console.error('Error creating poll:', error);
      alert('Failed to create poll. Please try again.');
    }
  };

  const endPoll = async (pollId) => {
    try {
      await pollService.endPoll(pollId);
      fetchPolls();
    } catch (error) {
      console.error('Error ending poll:', error);
      alert('Failed to end poll. Please try again.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">DJ Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Broadcast Controls */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
                Broadcast Controls
              </h2>

              <div className="space-y-6">
                {/* Broadcast Status */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Status</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isBroadcasting 
                        ? 'Broadcasting live'
                        : testMode
                          ? 'Testing audio input'
                          : 'Offline'
                      }
                    </p>
                  </div>
                  <div className="flex space-x-4">
                    <button
                      onClick={toggleBroadcast}
                      className={`px-4 py-2 rounded-md text-white font-medium ${
                        isBroadcasting
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-yellow-500 hover:bg-yellow-600'
                      }`}
                    >
                      <span className="flex items-center">
                        {isBroadcasting ? (
                          <>
                            <StopIcon className="h-5 w-5 mr-1" />
                            End Broadcast
                          </>
                        ) : (
                          <>
                            <PlayIcon className="h-5 w-5 mr-1" />
                            Start Broadcast
                          </>
                        )}
                      </span>
                    </button>
                    <button
                      onClick={toggleTestMode}
                      className={`px-4 py-2 rounded-md font-medium ${
                        testMode
                          ? 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200'
                          : 'text-maroon-700 bg-maroon-100 hover:bg-maroon-200 dark:bg-maroon-900/30 dark:text-yellow-400 dark:hover:bg-maroon-900/50'
                      }`}
                    >
                      {testMode ? 'Stop Test' : 'Test Audio'}
                    </button>
                  </div>
                </div>

                {/* Audio Input Selector */}
                <div>
                  <label htmlFor="audioDevice" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Audio Input Device
                  </label>
                  <select
                    id="audioDevice"
                    value={audioInputDevice}
                    onChange={handleAudioDeviceChange}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-500 focus:ring-maroon-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                  >
                    {availableAudioDevices.map(device => (
                      <option key={device.id} value={device.id}>
                        {device.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Audio Level Meter */}
                {(isBroadcasting || testMode) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Audio Input Level
                    </label>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${
                          audioInputLevel > 80 
                            ? 'bg-red-500' 
                            : audioInputLevel > 60 
                              ? 'bg-yellow-500' 
                              : 'bg-green-500'
                        }`}
                        style={{ width: `${audioInputLevel}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>Low</span>
                      <span>Medium</span>
                      <span>High</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Chat Messages */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
                Recent Chat Messages
              </h2>

              <div className="max-h-48 overflow-y-auto">
                {chatMessages.length > 0 ? (
                  <ul className="space-y-3">
                    {chatMessages.map((msg) => (
                      <li key={msg.id} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                        <div className="flex justify-between">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{msg.user}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{msg.time}</p>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{msg.message}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">No chat messages yet</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Analytics and Server Management */}
        <div>
          {/* Live Analytics */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
                Live Analytics
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-red-50 dark:bg-red-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-red-600 dark:text-red-200">Current Listeners</p>
                    <UserGroupIcon className="h-5 w-5 text-red-600 dark:text-red-200" />
                  </div>
                  <p className="text-2xl font-semibold text-red-700 dark:text-red-100 mt-2">{analytics.viewerCount}</p>
                </div>

                <div className="p-4 bg-red-50 dark:bg-red-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-red-600 dark:text-red-200">Peak Listeners</p>
                    <ChartBarIcon className="h-5 w-5 text-red-600 dark:text-red-200" />
                  </div>
                  <p className="text-2xl font-semibold text-red-700 dark:text-red-100 mt-2">{analytics.peakViewers}</p>
                </div>

                <div className="p-4 bg-red-50 dark:bg-red-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-red-600 dark:text-red-200">Chat Messages</p>
                    <ChatBubbleLeftRightIcon className="h-5 w-5 text-red-600 dark:text-red-200" />
                  </div>
                  <p className="text-2xl font-semibold text-red-700 dark:text-red-100 mt-2">{analytics.chatMessages}</p>
                </div>

                <div className="p-4 bg-red-50 dark:bg-red-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-red-600 dark:text-red-200">Song Requests</p>
                    <MicrophoneIcon className="h-5 w-5 text-red-600 dark:text-red-200" />
                  </div>
                  <p className="text-2xl font-semibold text-red-700 dark:text-red-100 mt-2">{analytics.songRequests}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Other Live Broadcasts */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
                Other Live Broadcasts
              </h2>

              {otherLiveBroadcasts.length > 0 ? (
                <div className="space-y-4">
                  {otherLiveBroadcasts.map(broadcast => (
                    <div key={broadcast.id} className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-md font-medium text-gray-900 dark:text-white">{broadcast.title}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            DJ: {broadcast.createdBy?.name || 'Unknown DJ'}
                          </p>
                          {broadcast.actualStart && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Started: {new Date(broadcast.actualStart).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          <span className="h-2 w-2 rounded-full bg-red-500 mr-1 animate-pulse"></span>
                          LIVE
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">No other DJs are currently broadcasting</p>
              )}
            </div>
          </div>

          {/* Server Schedule Management */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
                Server Schedule Management
              </h2>

              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Server Status</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                    {serverRunning ? (
                      <>
                        <CheckCircleIcon className="h-4 w-4 text-green-500 mr-1" />
                        Running
                      </>
                    ) : (
                      <>
                        <XCircleIcon className="h-4 w-4 text-red-500 mr-1" />
                        Stopped
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={toggleServer}
                  className={`px-4 py-2 rounded-md text-white font-medium ${
                    serverRunning
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-yellow-500 hover:bg-yellow-600'
                  }`}
                >
                  {serverRunning ? 'Stop Server' : 'Start Server'}
                </button>
              </div>

              <form onSubmit={handleServerScheduleSubmit}>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="scheduledStart" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Scheduled Start
                    </label>
                    <input
                      type="datetime-local"
                      name="scheduledStart"
                      id="scheduledStart"
                      value={serverSchedule.scheduledStart}
                      onChange={handleServerScheduleChange}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                    />
                  </div>
                  <div>
                    <label htmlFor="scheduledEnd" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Scheduled End
                    </label>
                    <input
                      type="datetime-local"
                      name="scheduledEnd"
                      id="scheduledEnd"
                      value={serverSchedule.scheduledEnd}
                      onChange={handleServerScheduleChange}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-maroon-700 hover:bg-maroon-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-600"
                  >
                    <ClockIcon className="h-5 w-5 mr-1" />
                    Update Schedule
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
