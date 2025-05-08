"use client"

import { useState, useEffect } from "react"
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  PaperAirplaneIcon,
  MusicalNoteIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/solid"
import AudioVisualizer from "../components/AudioVisualizer"
import { broadcastService, chatService, songRequestService, pollService } from "../services/api"

export default function ListenerDashboard() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(80)
  const [isLive, setIsLive] = useState(false)
  const [nextBroadcast, setNextBroadcast] = useState(null)
  const [currentBroadcastId, setCurrentBroadcastId] = useState(null)

  // Chat state
  const [chatMessage, setChatMessage] = useState("")
  const [chatMessages, setChatMessages] = useState([])

  // Song request state
  const [songRequest, setSongRequest] = useState({ song: "", artist: "" })

  // Poll state
  const [currentPoll, setCurrentPoll] = useState(null)
  const [userVote, setUserVote] = useState(null)
  const [pollLoading, setPollLoading] = useState(false)

  // Tabs state for interaction section
  const [activeTab, setActiveTab] = useState("chat") // 'chat', 'request', 'poll'

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
          // You could add more logic here to select a specific broadcast if needed
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

    checkBroadcastStatus()
    const interval = setInterval(checkBroadcastStatus, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [])

  // Fetch chat messages when broadcast ID changes
  useEffect(() => {
    if (currentBroadcastId) {
      const fetchChatMessages = async () => {
        try {
          const response = await chatService.getMessages(currentBroadcastId);
          setChatMessages(response.data);
        } catch (error) {
          console.error("Error fetching chat messages:", error);
        }
      };

      fetchChatMessages();

      // Set up interval to periodically fetch new messages
      const interval = setInterval(fetchChatMessages, 5000); // Check every 5 seconds

      return () => clearInterval(interval);
    } else {
      // Reset chat messages when no broadcast is live
      setChatMessages([]);
    }
  }, [currentBroadcastId]);

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
    if (!isLive) return
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const handleVolumeChange = (e) => {
    const newVolume = Number.parseInt(e.target.value, 10)
    setVolume(newVolume)
    if (newVolume === 0) {
      setIsMuted(true)
    } else if (isMuted) {
      setIsMuted(false)
    }
  }

  // Handle chat submission
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || !currentBroadcastId) return;

    const messageToSend = chatMessage.trim();
    setChatMessage(''); // Clear input immediately for better UX

    try {
      // Create message object to send to the server
      const messageData = {
        content: messageToSend
      };

      // Send message to the server
      await chatService.sendMessage(currentBroadcastId, messageData);

      // Fetch the latest messages (the server will have our new message)
      const response = await chatService.getMessages(currentBroadcastId);
      setChatMessages(response.data);

      // Scroll to bottom
      const chatContainer = document.querySelector('.chat-messages-container');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    } catch (error) {
      console.error("Error sending chat message:", error);
      alert("Failed to send message. Please try again.");
      setChatMessage(messageToSend); // Restore the message if sending failed
    }
  };

  // Handle song request submission
  const handleSongRequestSubmit = async (e) => {
    e.preventDefault()
    if (!songRequest.song.trim() || !songRequest.artist.trim() || !currentBroadcastId) return

    try {
      // Create song request object to send to the server
      const requestData = {
        songTitle: songRequest.song,
        artist: songRequest.artist
      };

      // Send song request to the server
      await songRequestService.createRequest(currentBroadcastId, requestData);

      // Show success message
      alert(`Song request submitted: "${songRequest.song}" by ${songRequest.artist}`);

      // Reset the form
      setSongRequest({ song: "", artist: "" });
    } catch (error) {
      console.error("Error submitting song request:", error);
      alert("Failed to submit song request. Please try again.");
    }
  }

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
  }

  // Render chat messages
  const renderChatMessages = () => (
    <div className="max-h-60 overflow-y-auto space-y-3 mb-4 chat-messages-container scrollbar-thin scrollbar-thumb-maroon-500 dark:scrollbar-thumb-maroon-700 scrollbar-track-gray-200 dark:scrollbar-track-gray-700">
      {chatMessages.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">No messages yet</p>
      ) : (
        chatMessages.map((msg) => {
          // Check if the message is from the current user
          const isCurrentUser = msg.sender && msg.sender.email === localStorage.getItem('userEmail');

          return (
            <div
              key={msg.id}
              className={`p-2 rounded-lg ${isCurrentUser ? "bg-maroon-100 dark:bg-maroon-900/30 ml-8" : "bg-gray-100 dark:bg-gray-700 mr-8"}`}
            >
              <div className="flex justify-between">
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {isCurrentUser ? "You" : (msg.sender ? msg.sender.name : "Unknown")}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">{msg.content}</p>
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
        onChange={(e) => setChatMessage(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-l-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
        disabled={!isLive}
      />
      <button
        type="submit"
        disabled={!isLive || !chatMessage.trim()}
        className={`p-2 rounded-r-md ${
          isLive && chatMessage.trim()
            ? "bg-maroon-700 hover:bg-maroon-800 text-white"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
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
            <div className="relative h-64 bg-gradient-to-r from-maroon-700 to-maroon-900 flex items-center justify-center px-4">
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
                      {nextBroadcast ? (
                        <p className="mt-2 text-sm">
                          Next broadcast: {nextBroadcast.title} on {nextBroadcast.date} at {nextBroadcast.time}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm">No upcoming broadcasts scheduled</p>
                      )}
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
                        isLive ? "bg-maroon-700 hover:bg-maroon-800" : "bg-gray-400 cursor-not-allowed"
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
                  <button
                      onClick={toggleMute}
                      className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  >
                    {isMuted ? <SpeakerXMarkIcon className="h-6 w-6" /> : <SpeakerWaveIcon className="h-6 w-6" />}
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
                      onClick={() => setActiveTab("chat")}
                      className={`flex-1 py-3 px-4 text-center text-sm font-medium ${
                          activeTab === "chat"
                              ? "text-maroon-700 border-b-2 border-maroon-700 dark:text-yellow-400 dark:border-yellow-400"
                              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      }`}
                  >
                    <ChatBubbleLeftRightIcon className="h-5 w-5 mx-auto mb-1" />
                    Chat
                  </button>
                  <button
                      onClick={() => setActiveTab("request")}
                      className={`flex-1 py-3 px-4 text-center text-sm font-medium ${
                          activeTab === "request"
                              ? "text-maroon-700 border-b-2 border-maroon-700 dark:text-yellow-400 dark:border-yellow-400"
                              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      }`}
                  >
                    <MusicalNoteIcon className="h-5 w-5 mx-auto mb-1" />
                    Request
                  </button>
                  <button
                      onClick={() => setActiveTab("poll")}
                      className={`flex-1 py-3 px-4 text-center text-sm font-medium ${
                          activeTab === "poll"
                              ? "text-maroon-700 border-b-2 border-maroon-700 dark:text-yellow-400 dark:border-yellow-400"
                              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      }`}
                  >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mx-auto mb-1"
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
                  </button>
                </div>

                {/* Tab Content */}
                <div className="p-4">
                  {/* Chat Panel */}
                  {activeTab === "chat" && (
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
                  {activeTab === "request" && (
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Request a Song</h3>
                        <form onSubmit={handleSongRequestSubmit} className="space-y-4">
                          <div>
                            <label
                                htmlFor="song"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                            >
                              Song Title
                            </label>
                            <input
                                type="text"
                                id="song"
                                value={songRequest.song}
                                onChange={(e) => setSongRequest({ ...songRequest, song: e.target.value })}
                                className="block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                placeholder="Enter song title"
                                disabled={!isLive}
                                required
                            />
                          </div>
                          <div>
                            <label
                                htmlFor="artist"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                            >
                              Artist
                            </label>
                            <input
                                type="text"
                                id="artist"
                                value={songRequest.artist}
                                onChange={(e) => setSongRequest({ ...songRequest, artist: e.target.value })}
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
                                      ? "bg-maroon-700 hover:bg-maroon-800 text-white"
                                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
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
                  {activeTab === "poll" && (
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">DJ Poll</h3>
                          {pollLoading && !currentPoll && (
                            <span className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">Loading polls...</span>
                          )}
                        </div>
                        {currentPoll ? (
                          <div className="mb-6">
                            <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">
                              {currentPoll.question}
                            </h4>
                            <div className="space-y-3">
                              {currentPoll.options.map((option) => {
                                const percentage = Math.round((option.votes / currentPoll.totalVotes) * 100) || 0
                                return (
                                    <div key={option.id} className="space-y-1">
                                      <button
                                          onClick={() => handlePollVote(option.id)}
                                          disabled={currentPoll.userVoted || !isLive || pollLoading}
                                          className={`w-full text-left p-2 rounded-md ${
                                              currentPoll.userVotedFor === option.id
                                                  ? "bg-maroon-100 dark:bg-maroon-900/30 border border-maroon-500"
                                                  : currentPoll.userVoted
                                                      ? "bg-gray-100 dark:bg-gray-700"
                                                      : pollLoading
                                                          ? "bg-gray-100 dark:bg-gray-700 cursor-wait"
                                                          : isLive
                                                              ? "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                              : "bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                                          }`}
                                      >
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                                            {option.text}
                                            {pollLoading && option.id === userVote?.optionId && (
                                              <span className="ml-2 inline-block animate-pulse">•••</span>
                                            )}
                                          </span>
                                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                            {percentage}% ({option.votes})
                                          </span>
                                        </div>
                                      </button>
                                      <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-maroon-700 dark:bg-yellow-500"
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                )
                              })}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-right">
                              Total votes: {currentPoll.totalVotes}
                            </p>
                          </div>
                        ) : (
                          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                            {pollLoading ? (
                              <span className="animate-pulse">Loading polls...</span>
                            ) : (
                              "No active polls"
                            )}
                          </p>
                        )}
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
  )
}
