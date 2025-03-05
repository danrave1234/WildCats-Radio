import { useState, useEffect } from 'react';
import { 
  PlayIcon, 
  PauseIcon, 
  SpeakerWaveIcon, 
  SpeakerXMarkIcon,
  PaperAirplaneIcon,
  MusicalNoteIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/solid';
import AudioVisualizer from '../components/AudioVisualizer';

export default function ListenerDashboard() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isLive, setIsLive] = useState(false);
  const [nextBroadcast, setNextBroadcast] = useState({
    title: "Morning Show with DJ Smith",
    date: "2025-03-05",
    time: "10:00 AM"
  });
  
  // Chat state
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { id: 1, user: 'listener123', message: 'Great song choice!', time: '3:42 PM' },
    { id: 2, user: 'musicfan45', message: 'Can you play some jazz next?', time: '3:44 PM' },
    { id: 3, user: 'WildcatsFan', message: 'Go Wildcats!', time: '3:47 PM' },
  ]);
  
  // Song request state
  const [songRequest, setSongRequest] = useState({ song: '', artist: '' });
  
  // Poll state
  const [currentPoll, setCurrentPoll] = useState({
    question: 'What genre should we play next?',
    options: [
      { id: 1, text: 'Pop', votes: 7 },
      { id: 2, text: 'Rock', votes: 5 },
      { id: 3, text: 'Hip Hop', votes: 12 },
      { id: 4, text: 'Electronic', votes: 3 }
    ],
    totalVotes: 27,
    userVoted: false,
    userVotedFor: null
  });
  
  // Tabs state for interaction section
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'request', 'poll'

  // Check if a broadcast is live (this would come from your backend in a real app)
  useEffect(() => {
    const checkBroadcastStatus = () => {
      // Mock API call to check if broadcast is live
      setTimeout(() => {
        setIsLive(Math.random() > 0.5); // Randomly set live status for demo
      }, 1000);
    };

    checkBroadcastStatus();
    const interval = setInterval(checkBroadcastStatus, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const togglePlay = () => {
    if (!isLive) return;
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value, 10);
    setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };
  
  // Handle chat submission
  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    
    const newMessage = {
      id: chatMessages.length + 1,
      user: 'You',
      message: chatMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setChatMessages([...chatMessages, newMessage]);
    setChatMessage('');
  };
  
  // Handle song request submission
  const handleSongRequestSubmit = (e) => {
    e.preventDefault();
    if (!songRequest.song.trim() || !songRequest.artist.trim()) return;
    
    // Here you would send the request to your backend
    console.log('Song request submitted:', songRequest);
    alert(`Song request submitted: "${songRequest.song}" by ${songRequest.artist}`);
    
    // Reset the form
    setSongRequest({ song: '', artist: '' });
  };
  
  // Handle poll vote
  const handlePollVote = (optionId) => {
    if (currentPoll.userVoted) return;
    
    // In a real app, you would send this to your backend
    setCurrentPoll(prev => {
      const updatedOptions = prev.options.map(option => 
        option.id === optionId 
          ? { ...option, votes: option.votes + 1 }
          : option
      );
      
      return {
        ...prev,
        options: updatedOptions,
        totalVotes: prev.totalVotes + 1,
        userVoted: true,
        userVotedFor: optionId
      };
    });
  };

  // Render chat messages
  const renderChatMessages = () => (
    <div className="max-h-60 overflow-y-auto space-y-3 mb-4">
      {chatMessages.map((msg) => (
        <div key={msg.id} className={`p-2 rounded-lg ${msg.user === 'You' ? 'bg-blue-100 dark:bg-blue-900 ml-8' : 'bg-gray-100 dark:bg-gray-700 mr-8'}`}>
          <div className="flex justify-between">
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{msg.user}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{msg.time}</span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">{msg.message}</p>
        </div>
      ))}
    </div>
  );

  // Render chat input
  const renderChatInput = () => (
    <form onSubmit={handleChatSubmit} className="flex items-center">
      <input
        type="text"
        value={chatMessage}
        onChange={(e) => setChatMessage(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-l-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        disabled={!isLive}
      />
      <button
        type="submit"
        disabled={!isLive}
        className={`p-2 rounded-r-md ${
          isLive
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        <PaperAirplaneIcon className="h-5 w-5" />
      </button>
    </form>
  );

  return (
    <div className="container mx-auto px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Listener Dashboard</h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
          {/* Hero section with status */}
          <div className="relative h-64 bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center px-4">
            <div className="text-center text-white">
              <div className="flex items-center justify-center mb-4">
                {isLive ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-600 text-white">
                    <span className="h-2 w-2 rounded-full bg-white mr-1 animate-pulse"></span>
                    LIVE NOW
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-600 text-white">
                    OFF AIR
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold mb-2">WildCats Radio</h2>
              {isLive ? (
                <p>Tune in now to the live broadcast!</p>
              ) : (
                <div>
                  <p>No broadcast currently active</p>
                  <p className="mt-2 text-sm">
                    Next broadcast: {nextBroadcast.title} on {nextBroadcast.date} at {nextBroadcast.time}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Controls */}
          <div className="p-6">
            <div className="flex flex-col items-center">
              {/* Play/Pause Button */}
              <button 
                onClick={togglePlay}
                disabled={!isLive}
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg mb-6 ${
                  isLive ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'
                } transition-colors duration-200`}
              >
                {isPlaying ? (
                  <PauseIcon className="h-10 w-10 text-white" />
                ) : (
                  <PlayIcon className="h-10 w-10 text-white" />
                )}
              </button>
              
              {/* Volume Controls */}
              <div className="w-full max-w-md flex items-center space-x-4 mb-6">
                <button onClick={toggleMute} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                  {isMuted ? (
                    <SpeakerXMarkIcon className="h-6 w-6" />
                  ) : (
                    <SpeakerWaveIcon className="h-6 w-6" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm text-gray-600 dark:text-gray-300 w-8">{volume}%</span>
              </div>
              
              {/* Audio Visualizer */}
              {isLive && (
                <div className="w-full max-w-md mb-6">
                  <AudioVisualizer isPlaying={isPlaying && !isMuted} />
                </div>
              )}
              
              {isLive && isPlaying && (
                <div className="w-full max-w-md p-4 bg-gray-100 dark:bg-gray-700 rounded-lg mb-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Now Playing</h3>
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded"></div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Current Song Title</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Artist Name</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Tabs for interaction */}
            <div className="mt-6">
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 py-3 px-4 text-center text-sm font-medium ${
                    activeTab === 'chat'
                      ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <ChatBubbleLeftRightIcon className="h-5 w-5 mx-auto mb-1" />
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab('request')}
                  className={`flex-1 py-3 px-4 text-center text-sm font-medium ${
                    activeTab === 'request'
                      ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <MusicalNoteIcon className="h-5 w-5 mx-auto mb-1" />
                  Request
                </button>
                <button
                  onClick={() => setActiveTab('poll')}
                  className={`flex-1 py-3 px-4 text-center text-sm font-medium ${
                    activeTab === 'poll'
                      ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Poll
                </button>
              </div>
              
              {/* Tab Content */}
              <div className="p-4">
                {/* Chat Panel */}
                {activeTab === 'chat' && (
                  <div>
                    {renderChatMessages()}
                    {renderChatInput()}
                    {!isLive && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                        Chat is only available during live broadcasts
                      </p>
                    )}
                  </div>
                )}
                
                {/* Song Request Panel */}
                {activeTab === 'request' && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Request a Song</h3>
                    <form onSubmit={handleSongRequestSubmit} className="space-y-4">
                      <div>
                        <label htmlFor="song" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Song Title
                        </label>
                        <input
                          type="text"
                          id="song"
                          value={songRequest.song}
                          onChange={(e) => setSongRequest({...songRequest, song: e.target.value})}
                          className="block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="Enter song title"
                          disabled={!isLive}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="artist" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Artist
                        </label>
                        <input
                          type="text"
                          id="artist"
                          value={songRequest.artist}
                          onChange={(e) => setSongRequest({...songRequest, artist: e.target.value})}
                          className="block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="Enter artist name"
                          disabled={!isLive}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!isLive}
                        className={`w-full py-2 px-4 rounded-md ${
                          isLive
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        Submit Request
                      </button>
                    </form>
                    {!isLive && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
                        Song requests are only available during live broadcasts
                      </p>
                    )}
                  </div>
                )}
                
                {/* Poll Panel */}
                {activeTab === 'poll' && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">DJ Poll</h3>
                    <div className="mb-6">
                      <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">
                        {currentPoll.question}
                      </h4>
                      <div className="space-y-3">
                        {currentPoll.options.map((option) => {
                          const percentage = Math.round((option.votes / currentPoll.totalVotes) * 100) || 0;
                          return (
                            <div key={option.id} className="space-y-1">
                              <button
                                onClick={() => handlePollVote(option.id)}
                                disabled={currentPoll.userVoted || !isLive}
                                className={`w-full text-left p-2 rounded-md ${
                                  currentPoll.userVotedFor === option.id
                                    ? 'bg-blue-100 dark:bg-blue-900 border border-blue-500'
                                    : currentPoll.userVoted
                                      ? 'bg-gray-100 dark:bg-gray-700'
                                      : isLive
                                        ? 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        : 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {option.text}
                                  </span>
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                    {percentage}% ({option.votes})
                                  </span>
                                </div>
                              </button>
                              <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-600 dark:bg-blue-500" 
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-right">
                        Total votes: {currentPoll.totalVotes}
                      </p>
                    </div>
                    {!isLive && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        Active polls will appear during live broadcasts
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 