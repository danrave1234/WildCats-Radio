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

export default function DJDashboard() {
  // Broadcast state
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [audioInputLevel, setAudioInputLevel] = useState(0);
  const [audioInputDevice, setAudioInputDevice] = useState('default');
  const [availableAudioDevices, setAvailableAudioDevices] = useState([]);
  
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
  
  // Chat messages state (mock)
  const [chatMessages, setChatMessages] = useState([
    { id: 1, user: 'listener123', message: 'Great song choice!', time: '3:42 PM' },
    { id: 2, user: 'musicfan45', message: 'Can you play some jazz next?', time: '3:44 PM' },
    { id: 3, user: 'student2024', message: 'Shoutout to the bio department!', time: '3:47 PM' },
  ]);
  
  // Song requests state (mock)
  const [songRequests, setSongRequests] = useState([
    { id: 1, song: 'Blinding Lights', artist: 'The Weeknd', requestedBy: 'listener123', time: '3:43 PM' },
    { id: 2, song: 'As It Was', artist: 'Harry Styles', requestedBy: 'musiclover99', time: '3:46 PM' },
  ]);

  // Check for audio input devices
  useEffect(() => {
    // Mock audio devices for demo
    setAvailableAudioDevices([
      { id: 'default', label: 'Default Microphone' },
      { id: 'mic1', label: 'Headset Microphone' },
      { id: 'mic2', label: 'Built-in Microphone' },
    ]);
    
    // Simulate audio input levels if broadcasting or testing
    let interval;
    if (isBroadcasting || testMode) {
      interval = setInterval(() => {
        setAudioInputLevel(Math.random() * 100);
        
        // Update mock analytics if broadcasting
        if (isBroadcasting) {
          setAnalytics(prev => ({
            viewerCount: Math.floor(Math.random() * 20) + 10,
            peakViewers: Math.max(prev.peakViewers, prev.viewerCount),
            chatMessages: prev.chatMessages + (Math.random() > 0.7 ? 1 : 0),
            songRequests: prev.songRequests + (Math.random() > 0.9 ? 1 : 0),
          }));
        }
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [isBroadcasting, testMode]);

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
  const toggleBroadcast = () => {
    if (isBroadcasting) {
      // End broadcast
      setIsBroadcasting(false);
      setTestMode(false);
      
      // In a real app, you would send a request to your backend to stop the broadcast
      console.log('Ending broadcast');
    } else {
      // Start broadcast
      setIsBroadcasting(true);
      setTestMode(false);
      
      // In a real app, you would send a request to your backend to start the broadcast
      console.log('Starting broadcast');
      console.log('Using audio device:', audioInputDevice);
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
                          : 'bg-green-600 hover:bg-green-700'
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
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200'
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
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
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
                <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-200">Current Listeners</p>
                    <UserGroupIcon className="h-5 w-5 text-blue-600 dark:text-blue-200" />
                  </div>
                  <p className="text-2xl font-semibold text-blue-700 dark:text-blue-100 mt-2">{analytics.viewerCount}</p>
                </div>
                
                <div className="p-4 bg-purple-50 dark:bg-purple-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-purple-600 dark:text-purple-200">Peak Listeners</p>
                    <ChartBarIcon className="h-5 w-5 text-purple-600 dark:text-purple-200" />
                  </div>
                  <p className="text-2xl font-semibold text-purple-700 dark:text-purple-100 mt-2">{analytics.peakViewers}</p>
                </div>
                
                <div className="p-4 bg-green-50 dark:bg-green-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-green-600 dark:text-green-200">Chat Messages</p>
                    <ChatBubbleLeftRightIcon className="h-5 w-5 text-green-600 dark:text-green-200" />
                  </div>
                  <p className="text-2xl font-semibold text-green-700 dark:text-green-100 mt-2">{analytics.chatMessages}</p>
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
                      : 'bg-green-600 hover:bg-green-700'
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
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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