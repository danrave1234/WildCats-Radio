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
import { broadcastService, serverService, pollService, chatService } from '../services/api';

export default function DJDashboard() {
  // Broadcast state
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [audioInputLevel, setAudioInputLevel] = useState(0);
  const [audioInputDevice, setAudioInputDevice] = useState('default');
  const [availableAudioDevices, setAvailableAudioDevices] = useState([]);
  const [currentBroadcastId, setCurrentBroadcastId] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);

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

  // Fetch server schedules and check server status
  useEffect(() => {
    const fetchServerSchedules = async () => {
      try {
        const schedulesResponse = await serverService.getSchedules();
        setServerSchedules(schedulesResponse.data);

        const statusResponse = await serverService.getStatus();
        setServerRunning(statusResponse.data);
      } catch (error) {
        console.error('Error fetching server schedules:', error);
      }
    };

    fetchServerSchedules();

    // Refresh server status every 30 seconds
    const interval = setInterval(async () => {
      try {
        const statusResponse = await serverService.getStatus();
        setServerRunning(statusResponse.data);
      } catch (error) {
        console.error('Error checking server status:', error);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

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

        // If there are any live broadcasts, set isBroadcasting to true
        // and use the first live broadcast's ID as the current broadcast ID
        if (liveBroadcasts.length > 0) {
          setIsBroadcasting(true);
          setCurrentBroadcastId(liveBroadcasts[0].id);
        } else {
          setIsBroadcasting(false);
          setCurrentBroadcastId(null);
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

  // Fetch chat messages for the current broadcast
  useEffect(() => {
    const fetchChatMessages = async () => {
      if (!currentBroadcastId) return;

      try {
        const response = await chatService.getMessages(currentBroadcastId);
        setChatMessages(response.data);

        // Update analytics with the number of chat messages
        setAnalytics(prev => ({
          ...prev,
          chatMessages: response.data.length
        }));
      } catch (error) {
        console.error('Error fetching chat messages:', error);
      }
    };

    fetchChatMessages();

    // Set up interval to periodically refresh chat messages
    const interval = setInterval(fetchChatMessages, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [currentBroadcastId]);

  // Fetch polls for the current broadcast
  useEffect(() => {
    if (!currentBroadcastId) return;

    // Fetch polls when component mounts or when currentBroadcastId changes
    fetchPolls();

    // Set up interval to periodically refresh polls
    const interval = setInterval(fetchPolls, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [currentBroadcastId]);

  // Handle audio device change
  const handleAudioDeviceChange = (e) => {
    setAudioInputDevice(e.target.value);
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

  // Start test broadcast using test mode endpoint
  const startTestBroadcast = async () => {
    try {
      // Find a scheduled broadcast to start, or create a new one
      let broadcastToStart;

      // Look for a scheduled broadcast that hasn't started yet
      if (broadcasts.length > 0) {
        broadcastToStart = broadcasts.find(b => b.status === 'SCHEDULED');
      }

      if (broadcastToStart) {
        // Start an existing scheduled broadcast in test mode
        const response = await broadcastService.startTest(broadcastToStart.id);
        setCurrentBroadcastId(broadcastToStart.id);
      } else {
        // Create and start a new broadcast in test mode
        const newBroadcast = {
          title: 'Test Broadcast',
          description: 'Test broadcast started from DJ Dashboard',
          scheduledStart: new Date().toISOString(),
          scheduledEnd: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
        };

        const scheduleResponse = await broadcastService.schedule(newBroadcast);
        const createdBroadcast = scheduleResponse.data;

        const startResponse = await broadcastService.startTest(createdBroadcast.id);
        setCurrentBroadcastId(createdBroadcast.id);
      }

      setIsBroadcasting(true);
      console.log('Starting TEST broadcast');
      console.log('Using audio device:', audioInputDevice);
    } catch (error) {
      console.error('Error starting test broadcast:', error);
      alert('There was an error starting the test broadcast. Please try again.');
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
  const toggleServer = async () => {
    try {
      if (serverRunning) {
        // Stop the server
        await serverService.stopNow();
        setServerRunning(false);
        console.log('Stopping server');
      } else {
        // Start the server
        await serverService.startNow();
        setServerRunning(true);
        console.log('Starting server');
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
                    {isBroadcasting ? (
                      <button
                        onClick={toggleBroadcast}
                        className="px-4 py-2 rounded-md text-white font-medium bg-red-600 hover:bg-red-700"
                      >
                        <span className="flex items-center">
                          <StopIcon className="h-5 w-5 mr-1" />
                          End Broadcast
                        </span>
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={toggleBroadcast}
                          className="px-4 py-2 rounded-md text-white font-medium bg-yellow-500 hover:bg-yellow-600"
                          disabled={testMode}
                        >
                          <span className="flex items-center">
                            <PlayIcon className="h-5 w-5 mr-1" />
                            Start Broadcast
                          </span>
                        </button>
                        <button
                          onClick={startTestBroadcast}
                          className="px-4 py-2 rounded-md text-white font-medium bg-purple-500 hover:bg-purple-600"
                          disabled={testMode}
                        >
                          <span className="flex items-center">
                            <PlayIcon className="h-5 w-5 mr-1" />
                            Test Broadcast
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
                      </>
                    )}
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

              <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-maroon-500 dark:scrollbar-thumb-maroon-700 scrollbar-track-gray-200 dark:scrollbar-track-gray-700">
                {chatMessages.length > 0 ? (
                  <ul className="space-y-3">
                    {chatMessages.map((msg) => (
                      <li key={msg.id} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                        <div className="flex justify-between">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{msg.sender ? msg.sender.name : 'Unknown'}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                          </p>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{msg.content}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">No chat messages yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Create Poll */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
                Create Poll
              </h2>

              <form onSubmit={createPoll} className="space-y-4">
                <div>
                  <label htmlFor="question" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Poll Question
                  </label>
                  <input
                    type="text"
                    id="question"
                    name="question"
                    value={newPoll.question}
                    onChange={handlePollChange}
                    placeholder="Enter your question here"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-500 focus:ring-maroon-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Poll Options
                  </label>
                  {newPoll.options.map((option, index) => (
                    <div key={index} className="flex items-center mb-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-500 focus:ring-maroon-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border mr-2"
                        required
                      />
                      {index > 1 && (
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addOption}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
                  >
                    + Add Option
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-maroon-700 hover:bg-maroon-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-600"
                    disabled={!isBroadcasting}
                  >
                    Create Poll
                  </button>
                </div>
              </form>

              {/* Active Polls */}
              {polls.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Active Polls</h3>
                  <div className="space-y-4">
                    {polls.map(poll => (
                      <div key={poll.id} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-medium text-gray-900 dark:text-white">{poll.question}</h4>
                          {poll.active && (
                            <button
                              onClick={() => endPoll(poll.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              End Poll
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {poll.options.map((option, index) => {
                            const results = pollResults[poll.id] || {};
                            const votes = results[option] || 0;
                            const totalVotes = Object.values(results).reduce((sum, count) => sum + count, 0);
                            const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

                            return (
                              <div key={index} className="text-sm">
                                <div className="flex justify-between mb-1">
                                  <span className="text-gray-700 dark:text-gray-300">{option}</span>
                                  <span className="text-gray-500 dark:text-gray-400">{votes} votes ({percentage}%)</span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-maroon-500"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          {poll.active ? 'Active' : 'Ended'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

              {/* Weekly Schedule Overview */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Weekly Schedule</h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  {serverSchedules.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map(day => {
                        const daySchedule = serverSchedules.find(schedule => schedule.dayOfWeek === day);
                        return (
                          <div key={day} className="flex justify-between items-center p-2 border-b border-gray-200 dark:border-gray-600">
                            <div className="flex-1">
                              <p className="font-medium text-gray-700 dark:text-gray-300">{day.charAt(0) + day.slice(1).toLowerCase()}</p>
                            </div>
                            <div className="flex-1">
                              {daySchedule ? (
                                <div className="text-sm">
                                  <p className="text-gray-600 dark:text-gray-400">
                                    {daySchedule.scheduledStart} - {daySchedule.scheduledEnd}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-500">
                                    {daySchedule.status === 'RUNNING' ? (
                                      <span className="text-green-500">Running</span>
                                    ) : daySchedule.status === 'SCHEDULED' ? (
                                      <span className="text-yellow-500">Scheduled</span>
                                    ) : (
                                      <span className="text-red-500">Off</span>
                                    )}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400">No schedule</p>
                              )}
                            </div>
                            <div className="flex-none">
                              <button
                                onClick={() => {
                                  setSelectedDay(day);
                                  if (daySchedule) {
                                    setNewSchedule({
                                      dayOfWeek: day,
                                      scheduledStart: daySchedule.scheduledStart,
                                      scheduledEnd: daySchedule.scheduledEnd,
                                      automatic: daySchedule.automatic
                                    });
                                  } else {
                                    setNewSchedule({
                                      dayOfWeek: day,
                                      scheduledStart: '',
                                      scheduledEnd: '',
                                      automatic: true
                                    });
                                  }
                                }}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
                              >
                                {daySchedule ? 'Edit' : 'Add'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 dark:text-gray-400">No schedules configured yet</p>
                  )}
                </div>
              </div>

              {/* Schedule Form */}
              <form onSubmit={handleServerScheduleSubmit}>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  {serverSchedules.find(s => s.dayOfWeek === selectedDay) ? 'Edit' : 'Add'} Schedule for {selectedDay.charAt(0) + selectedDay.slice(1).toLowerCase()}
                </h3>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mb-4">
                  <div>
                    <label htmlFor="dayOfWeek" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Day of Week
                    </label>
                    <select
                      id="dayOfWeek"
                      name="dayOfWeek"
                      value={selectedDay}
                      onChange={handleDayChange}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                    >
                      <option value="MONDAY">Monday</option>
                      <option value="TUESDAY">Tuesday</option>
                      <option value="WEDNESDAY">Wednesday</option>
                      <option value="THURSDAY">Thursday</option>
                      <option value="FRIDAY">Friday</option>
                      <option value="SATURDAY">Saturday</option>
                      <option value="SUNDAY">Sunday</option>
                    </select>
                  </div>

                  <div className="flex items-center mt-6">
                    <input
                      type="checkbox"
                      id="automatic"
                      name="automatic"
                      checked={true}
                      readOnly
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="automatic" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Automatic (server will start/stop according to schedule)
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="scheduledStart" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      name="scheduledStart"
                      id="scheduledStart"
                      value={newSchedule.scheduledStart}
                      onChange={handleNewScheduleChange}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                    />
                  </div>
                  <div>
                    <label htmlFor="scheduledEnd" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      name="scheduledEnd"
                      id="scheduledEnd"
                      value={newSchedule.scheduledEnd}
                      onChange={handleNewScheduleChange}
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
                    {serverSchedules.find(s => s.dayOfWeek === selectedDay) ? 'Update' : 'Add'} Schedule
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
