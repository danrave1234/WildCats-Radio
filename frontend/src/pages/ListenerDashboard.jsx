"use client"

import { useState, useEffect, useRef } from "react";
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  PaperAirplaneIcon,
  MusicalNoteIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/solid";
import AudioVisualizer from "../components/AudioVisualizer";
import { broadcastService, chatService, songRequestService, pollService } from "../services/api";

export default function ListenerDashboard() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isLive, setIsLive] = useState(true); // For demo purposes, set to true
  const [nextBroadcast, setNextBroadcast] = useState(null);
  const [currentBroadcastId, setCurrentBroadcastId] = useState(1); // Demo ID

  // Chat state
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);

  // Song request state
  const [songRequest, setSongRequest] = useState({ song: "", artist: "", dedication: "" });

  // Poll state
  const [currentPoll, setCurrentPoll] = useState({
    id: 1,
    question: "Which song should we play next?",
    options: [
      { id: 1, text: "Song Title 1", votes: 10 },
      { id: 2, text: "Song Title 2", votes: 15 },
      { id: 3, text: "Song Title 3", votes: 25 }
    ],
    totalVotes: 50,
    userVoted: false
  });
  const [userVote, setUserVote] = useState(null);
  const [pollLoading, setPollLoading] = useState(false);

  // Tabs state for interaction section
  const [activeTab, setActiveTab] = useState("song"); // 'song', 'poll', 'chat'
  
  // Currently playing song
  const [currentSong, setCurrentSong] = useState({
    title: "Higher Ground",
    artist: "TNGHT"
  });

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const chatContainerRef = useRef(null);

  // Add this helper function at the top of the component
  const isAtBottom = (container) => {
    if (!container) return true;
    const { scrollTop, scrollHeight, clientHeight } = container;
    return Math.abs(scrollHeight - clientHeight - scrollTop) < 10;
  };

  // Function to scroll to bottom
  const scrollToBottom = () => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  // Update the chat messages effect
  useEffect(() => {
    if (currentBroadcastId) {
      const fetchChatMessages = async () => {
        try {
          const response = await chatService.getMessages(currentBroadcastId);
          const newMessages = response.data.filter(msg => msg.broadcastId === currentBroadcastId);
          
          // Check if we're at the bottom before updating messages
          const container = chatContainerRef.current;
          const wasAtBottom = isAtBottom(container);
          
          // Update messages
          setChatMessages(newMessages);
          
          // Only scroll if user was already at the bottom
          if (wasAtBottom) {
            setTimeout(() => {
              if (container) {
                container.scrollTop = container.scrollHeight;
              }
            }, 100);
          }
        } catch (error) {
          console.error("Error fetching chat messages:", error);
        }
      };

      fetchChatMessages();
      const interval = setInterval(fetchChatMessages, 5000);

      return () => {
        clearInterval(interval);
        setChatMessages([]);
      };
    } else {
      setChatMessages([]);
    }
  }, [currentBroadcastId]);

  // Update the scroll event listener
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setShowScrollBottom(!isAtBottom(container));
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle chat submission
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || !currentBroadcastId) return;

    // Validate message length
    if (chatMessage.length > 1500) {
      alert("Message cannot exceed 1500 characters");
      return;
    }

    const messageToSend = chatMessage.trim();
    setChatMessage(''); // Clear input immediately for better UX

    try {
      // Create message object to send to the server
      const messageData = {
        content: messageToSend
      };

      // Send message to the server
      await chatService.sendMessage(currentBroadcastId, messageData);

      // Fetch the latest messages
      const response = await chatService.getMessages(currentBroadcastId);
      setChatMessages(response.data);

      // Always scroll to bottom after sending your own message
      scrollToBottom();
    } catch (error) {
      console.error("Error sending chat message:", error);
      if (error.response?.data?.message?.includes("1500 characters")) {
        alert("Message cannot exceed 1500 characters");
      } else {
        alert("Failed to send message. Please try again.");
      }
      setChatMessage(messageToSend); // Restore the message if sending failed
    }
  };

  // Check if a broadcast is live
  useEffect(() => {
    const checkBroadcastStatus = async () => {
      try {
        // Fetch live broadcasts from API
        const response = await broadcastService.getLive();
        const liveBroadcasts = response.data;

        // If there are any live broadcasts, set isLive to true
        if (liveBroadcasts && liveBroadcasts.length > 0) {
          setIsLive(true);
          // Set the first live broadcast as the current one
          const currentBroadcast = liveBroadcasts[0];
          setCurrentBroadcastId(currentBroadcast.id);
          console.log("Live broadcast:", currentBroadcast);
        } else {
          setIsLive(false);
          // If no live broadcasts, check for upcoming broadcasts
          try {
            const upcomingResponse = await broadcastService.getUpcoming();
            const upcomingBroadcasts = upcomingResponse.data;

            if (upcomingBroadcasts && upcomingBroadcasts.length > 0) {
              // Set the next broadcast
              const next = upcomingBroadcasts[0];
              setNextBroadcast({
                title: next.title,
                date: new Date(next.scheduledStart).toLocaleDateString(),
                time: new Date(next.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              });
            } else {
              setNextBroadcast(null);
            }
          } catch (error) {
            console.error("Error fetching upcoming broadcasts:", error);
          }
        }
      } catch (error) {
        console.error("Error checking broadcast status:", error);
        setIsLive(false);
      }
    }

    checkBroadcastStatus();
    const interval = setInterval(checkBroadcastStatus, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  // Fetch active polls for the current broadcast
  useEffect(() => {
    if (currentBroadcastId && isLive) {
      const fetchActivePolls = async () => {
        try {
          setPollLoading(true);
          const response = await pollService.getActivePollsForBroadcast(currentBroadcastId);

          if (response.data && response.data.length > 0) {
            // Get the first active poll
            const activePoll = response.data[0];

            // Check if the user has already voted
            try {
              const hasVotedResponse = await pollService.hasUserVoted(activePoll.id);

              if (hasVotedResponse.data) {
                // User has voted, get their vote
                const userVoteResponse = await pollService.getUserVote(activePoll.id);
                setUserVote(userVoteResponse.data);

                // Get poll results
                const resultsResponse = await pollService.getPollResults(activePoll.id);

                // Combine poll data with results
                setCurrentPoll({
                  ...activePoll,
                  options: resultsResponse.data.options,
                  totalVotes: resultsResponse.data.totalVotes,
                  userVoted: true,
                  userVotedFor: userVoteResponse.data.optionId
                });
              } else {
                // User hasn't voted
                setCurrentPoll({
                  ...activePoll,
                  totalVotes: activePoll.options.reduce((sum, option) => sum + option.votes, 0),
                  userVoted: false
                });
              }
            } catch (error) {
              console.error("Error checking user vote:", error);
              setCurrentPoll({
                ...activePoll,
                totalVotes: activePoll.options.reduce((sum, option) => sum + option.votes, 0),
                userVoted: false
              });
            }
          } else {
            setCurrentPoll(null);
          }
        } catch (error) {
          console.error("Error fetching active polls:", error);
        } finally {
          setPollLoading(false);
        }
      };

      fetchActivePolls();

      // Set up interval to periodically check for new polls
      const interval = setInterval(fetchActivePolls, 10000); // Check every 10 seconds

      return () => clearInterval(interval);
    } else {
      // Reset poll when no broadcast is live
      setCurrentPoll(null);
    }
  }, [currentBroadcastId, isLive]);

  const togglePlay = () => {
    if (!isLive) return;
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e) => {
    const newVolume = Number.parseInt(e.target.value, 10);
    setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  // Handle song request submission
  const handleSongRequestSubmit = async (e) => {
    e.preventDefault();
    if (!songRequest.song.trim() || !songRequest.artist.trim() || !currentBroadcastId) return;

    try {
      // Create song request object to send to the server
      const requestData = {
        songTitle: songRequest.song,
        artist: songRequest.artist,
        dedication: songRequest.dedication
      };

      // Send song request to the server
      await songRequestService.createRequest(currentBroadcastId, requestData);

      // Show success message
      alert(`Song request submitted: "${songRequest.song}" by ${songRequest.artist}`);

      // Reset the form
      setSongRequest({ song: "", artist: "", dedication: "" });
    } catch (error) {
      console.error("Error submitting song request:", error);
      alert("Failed to submit song request. Please try again.");
    }
  };

  // Handle poll vote
  const handlePollVote = async (optionId) => {
    if (!currentPoll || currentPoll.userVoted || !isLive) return;

    try {
      setPollLoading(true);

      // Send vote to backend
      const voteData = {
        pollId: currentPoll.id,
        optionId: optionId
      };

      await pollService.vote(currentPoll.id, voteData);

      // Get updated poll results
      const resultsResponse = await pollService.getPollResults(currentPoll.id);

      // Update user vote
      const userVoteResponse = await pollService.getUserVote(currentPoll.id);
      setUserVote(userVoteResponse.data);

      // Update current poll with results
      setCurrentPoll(prev => ({
        ...prev,
        options: resultsResponse.data.options,
        totalVotes: resultsResponse.data.totalVotes,
        userVoted: true,
        userVotedFor: optionId
      }));

    } catch (error) {
      console.error("Error submitting vote:", error);
      alert("Failed to submit vote. Please try again.");
    } finally {
      setPollLoading(false);
    }
  };

  // Render chat messages
  const renderChatMessages = () => (
    <div className="max-h-60 overflow-y-auto space-y-3 mb-4 chat-messages-container scrollbar-thin scrollbar-thumb-maroon-500 dark:scrollbar-thumb-maroon-700 scrollbar-track-gray-200 dark:scrollbar-track-gray-700">
      {chatMessages.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">No messages yet</p>
      ) : (
        chatMessages.map((msg) => {
          // Check if the message is from a DJ
          const isDJ = msg.sender && msg.sender.name.includes("DJ");
          const initials = msg.sender.name.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2);
          
          // Parse the createdAt timestamp from the backend
          const messageDate = msg.createdAt ? new Date(msg.createdAt + 'Z') : null;
          const formattedDate = messageDate ? new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }).format(messageDate) : 'Invalid Date';
          
          const formattedTime = messageDate ? new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }).format(messageDate) : 'Invalid Time';
          
          return (
            <div
              key={msg.id}
              className="mb-3"
            >
              <div className="flex items-center mb-1">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs text-white font-medium ${isDJ ? 'bg-maroon-600' : 'bg-gray-500'}`}>
                  {isDJ ? 'DJ' : initials}
                </div>
                <div className="ml-2">
                  <span className="font-medium text-sm text-gray-900 dark:text-white">{msg.sender.name}</span>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <span>{formattedDate}</span>
                    <span className="mx-1">•</span>
                    <span>{formattedTime}</span>
                  </div>
                </div>
              </div>
              <div className={`rounded-lg p-3 ml-8 ${isDJ ? 'bg-maroon-100 dark:bg-maroon-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                <p className="text-sm text-gray-800 dark:text-gray-200">{msg.content}</p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  // Render chat input
  const renderChatInput = () => (
    <form onSubmit={handleChatSubmit} className="flex items-center">
      <input
        type="text"
        value={chatMessage}
        onChange={(e) => {
          // Limit input to 1500 characters
          if (e.target.value.length <= 1500) {
            setChatMessage(e.target.value);
          }
        }}
        placeholder="Type your message..."
        className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-l-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
        disabled={!isLive}
        maxLength={1500}
      />
      <button
        type="submit"
        disabled={!isLive || !chatMessage.trim() || chatMessage.length > 1500}
        className={`p-2 rounded-r-md ${
          isLive && chatMessage.trim() && chatMessage.length <= 1500
            ? "bg-maroon-700 hover:bg-maroon-800 text-white"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
      >
        <PaperAirplaneIcon className="h-5 w-5" />
      </button>
    </form>
  );

  return (
    <div className="container mx-auto px-4 pb-6 bg-gray-100 dark:bg-gray-900">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 pt-6">Broadcast Stream</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content area - left 2/3 */}
        <div className="lg:col-span-2 flex flex-col">
          {/* Broadcast player */}
          <div className="bg-maroon-700 rounded-lg overflow-hidden mb-6 h-[200px] flex flex-col justify-center">
            {/* Live indicator */}
            <div className="absolute p-2 px-4">
              {isLive ? (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-600 text-white">
                  <span className="h-2 w-2 rounded-full bg-white mr-1 animate-pulse"></span>
                  LIVE
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-600 text-white">
                  OFF AIR
                </span>
              )}
            </div>

            {isLive ? (
              <>
                <div className="flex p-4">
                  {/* Album art / Left section */}
                  <div className="w-24 h-24 bg-maroon-800 flex items-center justify-center text-white text-2xl rounded-lg">
                    $
                  </div>

                  {/* Track info */}
                  <div className="ml-4 text-white">
                    <h3 className="text-xl font-bold">Afternoon Mix</h3>
                    <p className="text-sm opacity-80">Hosted by DJ Wildcat</p>
                    
                    <div className="mt-4">
                      <p className="text-xs uppercase opacity-60">NOW PLAYING</p>
                      <p className="text-sm font-medium">{currentSong.title}</p>
                      <p className="text-xs opacity-70">{currentSong.artist}</p>
                    </div>
                  </div>
                </div>
                
                {/* Volume control */}
                <div className="flex items-center px-4 py-3">
                  <button onClick={toggleMute} className="text-white mr-2">
                    {isMuted ? (
                      <SpeakerXMarkIcon className="h-5 w-5" />
                    ) : (
                      <SpeakerWaveIcon className="h-5 w-5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="ml-2 text-white text-xs w-7 text-right">{volume}%</div>
                </div>
              </>
            ) : (
              <div className="text-center text-white">
                <h2 className="text-2xl font-bold mb-3">WildCats Radio</h2>
                <p className="mb-2">No broadcast currently active</p>
                {nextBroadcast ? (
                  <p className="text-sm opacity-70">
                    Next broadcast: {nextBroadcast.title} on {nextBroadcast.date} at {nextBroadcast.time}
                  </p>
                ) : (
                  <p className="text-sm opacity-70">No upcoming broadcasts scheduled</p>
                )}
              </div>
            )}
          </div>

          {/* Interactive section tabs */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex-grow">
            {/* Tab headers */}
            <div className="flex">
              <button
                onClick={() => setActiveTab("song")}
                className={`flex-1 py-3 px-4 text-center text-sm font-medium ${
                  activeTab === "song"
                    ? "border-b-2 border-maroon-700 text-maroon-700 dark:border-maroon-500 dark:text-maroon-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 border-b border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex justify-center items-center">
                  <MusicalNoteIcon className="h-5 w-5 mr-2" />
                  Song Request
                </div>
              </button>
              <button
                onClick={() => setActiveTab("poll")}
                className={`flex-1 py-3 px-4 text-center text-sm font-medium ${
                  activeTab === "poll"
                    ? "border-b-2 border-maroon-700 text-maroon-700 dark:border-maroon-500 dark:text-maroon-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 border-b border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex justify-center items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  Poll
                </div>
              </button>
            </div>

            {/* Tab content */}
            <div className="bg-white dark:bg-gray-800 flex-grow flex flex-col h-[450px]">
              {/* Song Request Tab */}
              {activeTab === "song" && (
                <div className="p-6 flex-grow flex flex-col h-full">
                  {isLive ? (
                    <form onSubmit={handleSongRequestSubmit} className="space-y-5 flex-grow flex flex-col">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Song Title
                        </label>
                        <input
                          type="text"
                          value={songRequest.song}
                          onChange={(e) => setSongRequest({ ...songRequest, song: e.target.value })}
                          placeholder="Enter song title"
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Artist
                        </label>
                        <input
                          type="text"
                          value={songRequest.artist}
                          onChange={(e) => setSongRequest({ ...songRequest, artist: e.target.value })}
                          placeholder="Enter artist name"
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          required
                        />
                      </div>
                      
                      <div className="flex-grow">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Dedication (Optional)
                        </label>
                        <textarea
                          value={songRequest.dedication}
                          onChange={(e) => setSongRequest({ ...songRequest, dedication: e.target.value })}
                          placeholder="Add a message or dedication"
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white h-full min-h-[120px]"
                        />
                      </div>
                      
                      <div className="mt-auto flex justify-between items-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Song requests are subject to availability and DJ's playlist.
                        </p>
                        <button
                          type="submit"
                          className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium py-2 px-6 rounded"
                        >
                          Submit Request
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center w-full">
                        <div className="flex items-center mb-8 justify-center">
                          <div className="bg-pink-100 dark:bg-maroon-900/30 rounded-full p-3 mr-4">
                            <MusicalNoteIcon className="h-6 w-6 text-maroon-600 dark:text-maroon-400" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white text-lg">Request a Song</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Let us know what you'd like to hear next</p>
                          </div>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400">Song requests are only available during live broadcasts</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Poll Tab */}
              {activeTab === "poll" && (
                <div className="p-6 flex-grow flex flex-col h-full">
                  {isLive ? (
                    <>
                      {pollLoading && !currentPoll ? (
                        <div className="text-center py-8 flex-grow flex items-center justify-center">
                          <p className="text-gray-500 dark:text-gray-400 animate-pulse">Loading polls...</p>
                        </div>
                      ) : currentPoll ? (
                        <div className="flex-grow flex flex-col">
                          <div className="space-y-6 mb-6 flex-grow">
                            {currentPoll.options.map((option) => {
                              const percentage = Math.round((option.votes / currentPoll.totalVotes) * 100) || 0;
                              return (
                                <div key={option.id} className="space-y-1">
                                  <div className="text-sm font-medium mb-2 text-gray-900 dark:text-white">Song Title</div>
                                  <div 
                                    className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden"
                                    onClick={() => !currentPoll.userVoted && handlePollVote(option.id)}
                                  >
                                    <div 
                                      className="h-8 bg-pink-200 dark:bg-maroon-900/30 flex items-center pl-3 text-xs text-gray-800 dark:text-gray-200"
                                      style={{ width: `${percentage}%` }}
                                    >
                                      {percentage}%
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          <div className="mt-auto flex justify-center">
                            <button
                              onClick={() => setCurrentPoll({ ...currentPoll, userVoted: true })}
                              disabled={currentPoll.userVoted}
                              className={`bg-yellow-500 hover:bg-yellow-600 text-black font-medium py-2 px-12 rounded ${
                                currentPoll.userVoted ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              Vote
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 flex-grow flex items-center justify-center">
                          <div>
                            <p className="text-gray-500 dark:text-gray-400 mb-2">No active polls</p>
                            <p className="text-sm text-gray-400 dark:text-gray-500">Active polls will appear during live broadcasts</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center w-full">
                        <div className="mb-8">
                          <h3 className="text-xl font-medium text-gray-900 dark:text-white">Vote</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">selects which you prefer the most?</p>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400">Polls are only available during live broadcasts</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live chat section - right 1/3 */}
        <div className="lg:col-span-1 flex flex-col">
          <div className="bg-maroon-700 text-white p-3 rounded-t-lg">
            <h3 className="font-medium">Live Chat</h3>
            <p className="text-xs opacity-70">00 listeners online</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg flex-grow flex flex-col h-[494px]">
            {isLive ? (
              <>
                <div 
                  ref={chatContainerRef}
                  className="flex-grow overflow-y-auto p-4 space-y-4 chat-messages-container relative"
                >
                  {chatMessages.map((msg) => {
                    const isDJ = msg.sender && msg.sender.name.includes("DJ");
                    const initials = msg.sender.name.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2);
                    
                    // Parse the createdAt timestamp from the backend
                    const messageDate = msg.createdAt ? new Date(msg.createdAt + 'Z') : null;
                    const formattedDate = messageDate ? new Intl.DateTimeFormat('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    }).format(messageDate) : 'Invalid Date';
                    
                    const formattedTime = messageDate ? new Intl.DateTimeFormat('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    }).format(messageDate) : 'Invalid Time';
                    
                    return (
                      <div key={msg.id} className="mb-4">
                        <div className="flex items-center mb-1">
                          <div className={`h-8 w-8 min-w-[2rem] rounded-full flex items-center justify-center text-xs text-white font-medium ${isDJ ? 'bg-maroon-600' : 'bg-gray-500'}`}>
                            {isDJ ? 'DJ' : initials}
                          </div>
                          <div className="ml-2 overflow-hidden">
                            <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{msg.sender.name}</span>
                          </div>
                        </div>
                        <div className="ml-10 space-y-1">
                          <div className={`rounded-lg p-3 message-bubble ${isDJ ? 'bg-maroon-100 dark:bg-maroon-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                            <p className="text-sm text-gray-800 dark:text-gray-200 chat-message" style={{ wordBreak: 'break-word', wordWrap: 'break-word', overflowWrap: 'break-word', maxWidth: '100%' }}>{msg.content}</p>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 pl-1">
                            {formattedDate} • {formattedTime}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Scroll to bottom button */}
                {showScrollBottom && (
                  <div className="absolute bottom-20 right-4">
                    <button
                      onClick={scrollToBottom}
                      className="bg-maroon-600 hover:bg-maroon-700 text-white rounded-full p-2.5 shadow-lg transition-all duration-200 ease-in-out flex items-center justify-center"
                      aria-label="Scroll to bottom"
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-5 w-5" 
                        viewBox="0 0 20 20" 
                        fill="currentColor"
                      >
                        <path 
                          fillRule="evenodd" 
                          d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L10 15.586l5.293-5.293a1 1 0 011.414 0z" 
                          clipRule="evenodd" 
                        />
                      </svg>
                    </button>
                  </div>
                )}
                
                <div className="p-2 border-t border-gray-200 dark:border-gray-700 mt-auto">
                  <form onSubmit={handleChatSubmit} className="flex flex-col">
                    <div className="flex mb-1">
                      <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => {
                          // Limit input to 1500 characters
                          if (e.target.value.length <= 1500) {
                            setChatMessage(e.target.value);
                          }
                        }}
                        placeholder="Type your message..."
                        className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-l-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white max-w-full"
                        maxLength={1500}
                      />
                      <button
                        type="submit"
                        disabled={!chatMessage.trim() || chatMessage.length > 1500}
                        className={`${
                          !chatMessage.trim() || chatMessage.length > 1500
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-maroon-700 hover:bg-maroon-800 dark:bg-maroon-600'
                        } text-white p-2 rounded-r-md flex-shrink-0`}
                      >
                        <PaperAirplaneIcon className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className={`${
                        chatMessage.length > 1500 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {chatMessage.length}/1500 characters
                      </span>
                      {chatMessage.length > 1500 && (
                        <span className="text-red-500">Message too long</span>
                      )}
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-gray-500 dark:text-gray-400">Chat is only available during live broadcasts</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}