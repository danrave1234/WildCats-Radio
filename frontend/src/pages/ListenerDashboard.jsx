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
import { broadcastService, chatService, songRequestService } from "../services/api"

export default function ListenerDashboard() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(80)
  const [isLive, setIsLive] = useState(false)
  const [nextBroadcast, setNextBroadcast] = useState(null)
  const [currentBroadcastId, setCurrentBroadcastId] = useState(null)
  const [streamUrl, setStreamUrl] = useState("")
  const [audioContext, setAudioContext] = useState(null)
  const [analyser, setAnalyser] = useState(null)
  const [dataArray, setDataArray] = useState(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [streamError, setStreamError] = useState(null)
  const audioRef = useRef(null)
  const animationRef = useRef(null)

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

  // Initialize audio player and fetch stream status
  useEffect(() => {
    // Create audio element if it doesn't exist
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume / 100;

      // Add event listeners
      audioRef.current.addEventListener('playing', () => {
        setIsPlaying(true);
        console.log('Stream is playing');
      });

      audioRef.current.addEventListener('pause', () => {
        setIsPlaying(false);
        console.log('Stream is paused');
      });

      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
        console.log('Stream ended');
      });

      audioRef.current.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        setStreamError('Error loading stream. Please try again.');
        setIsPlaying(false);

        // Try to reconnect if the stream fails
        if (reconnectAttempts < 3) {
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            if (audioRef.current) {
              audioRef.current.src = streamUrl;
              audioRef.current.load();
            }
          }, 3000);
        }
      });
    }

    return () => {
      // Clean up audio element and audio context when component unmounts
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }

      if (audioContext) {
        audioContext.close();
      }

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [volume, reconnectAttempts, streamUrl]);

  // Check if a broadcast is live and set up the stream URL
  useEffect(() => {
    const checkBroadcastStatus = async () => {
      try {
        // Fetch stream status from the API
        const statusResponse = await streamService.getStatus();
        const status = statusResponse.data;

        if (status.live && status.server === "UP") {
          setIsLive(true);

          // Get the listener stream URL for Icecast
          streamService.getListenerStreamUrl()
            .then(listenerStreamUrl => {
              setStreamUrl(listenerStreamUrl);

              // Set up audio player source
              if (audioRef.current && audioRef.current.src !== listenerStreamUrl) {
                audioRef.current.src = listenerStreamUrl;
                audioRef.current.load();
                console.log("Stream URL set:", listenerStreamUrl);
              }
            })
            .catch(error => {
              console.error("Error getting stream URL:", error);
              setStreamError("Failed to get stream URL");
            });

          // If there's a live broadcast, set it as the current one
          if (status.broadcast) {
            setCurrentBroadcastId(status.broadcast.id);
            console.log("Live broadcast:", status.broadcast);
          }
        } else {
          setIsLive(false);
          setStreamUrl("");

          // If audio is playing, stop it
          if (audioRef.current && !audioRef.current.paused) {
            audioRef.current.pause();
          }

          // Try to get upcoming broadcasts if nothing is live
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
        console.error("Error checking stream status:", error);
        setIsLive(false);
        setStreamError("Failed to connect to server. Please try again later.");
      }
    }

    checkBroadcastStatus();
    const interval = setInterval(checkBroadcastStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Set up audio visualizer when playing
  useEffect(() => {
    if (isPlaying && !audioContext && audioRef.current) {
      try {
        // Create audio context for visualization
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const audioSource = context.createMediaElementSource(audioRef.current);
        const audioAnalyser = context.createAnalyser();

        // Connect the audio to the analyser and then to the destination
        audioSource.connect(audioAnalyser);
        audioAnalyser.connect(context.destination);

        // Set up analyser
        audioAnalyser.fftSize = 256;
        const bufferLength = audioAnalyser.frequencyBinCount;
        const audioDataArray = new Uint8Array(bufferLength);

        setAudioContext(context);
        setAnalyser(audioAnalyser);
        setDataArray(audioDataArray);

        // Start visualization
        const updateVisualization = () => {
          if (analyser) {
            analyser.getByteFrequencyData(audioDataArray);
            animationRef.current = requestAnimationFrame(updateVisualization);
          }
        };

        updateVisualization();
      } catch (error) {
        console.error("Error setting up audio visualization:", error);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, audioContext, analyser]);

  // Update volume when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  // Toggle play/pause
  const togglePlay = () => {
    if (!isLive || !audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        // If we don't have a stream URL, get it first
        if (!audioRef.current.src && streamUrl) {
          audioRef.current.src = streamUrl;
          audioRef.current.load();
        }

        // Play with a catch for browser autoplay restrictions
        const playPromise = audioRef.current.play();

        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
              setStreamError(null);
            })
            .catch(error => {
              console.error("Playback failed:", error);
              setStreamError("Couldn't start playback. Click play again or check browser autoplay settings.");
              setIsPlaying(false);
            });
        }
      }
    } catch (error) {
      console.error("Error toggling playback:", error);
      setStreamError("Playback error. Please try again.");
    }
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.volume = !isMuted ? 0 : volume / 100;
    }
  };

  // Handle volume change
  const handleVolumeChange = (e) => {
    const newVolume = Number.parseInt(e.target.value, 10);
    setVolume(newVolume);

    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }

    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

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
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Listener Dashboard</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
            WildCats Radio Player
          </h2>

          <div className="relative">
            {/* Stream Status */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <span className={`h-3 w-3 rounded-full mr-2 ${isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {isLive ? 'Live Broadcasting' : 'Offline'}
                </span>
              </div>

              {isLive && (
                <span className="text-xs bg-maroon-100 text-maroon-800 dark:bg-maroon-900 dark:text-maroon-200 py-1 px-2 rounded-full">
                  {currentBroadcastId ? `Broadcast #${currentBroadcastId}` : 'Live Stream'}
                </span>
              )}
            </div>

            {/* Audio Visualizer */}
            <div className="h-24 mb-6">
              {isPlaying && analyser && dataArray ? (
                <AudioVisualizer analyser={analyser} dataArray={dataArray} />
              ) : (
                <div className="w-full h-full bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    {isLive ? 'Click play to start listening' : 'No broadcast currently available'}
                  </p>
                </div>
              )}
            </div>

            {/* Stream Error */}
            {streamError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200 rounded-md text-sm">
                {streamError}
              </div>
            )}

            {/* Player Controls */}
            <div className="flex items-center justify-between">
              <button
                onClick={togglePlay}
                disabled={!isLive}
                className={`p-3 rounded-full ${
                  !isLive
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                    : isPlaying
                    ? 'bg-maroon-100 text-maroon-800 hover:bg-maroon-200 dark:bg-maroon-900 dark:text-maroon-200 dark:hover:bg-maroon-800'
                    : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:hover:bg-yellow-800'
                }`}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <PauseIcon className="h-8 w-8" />
                ) : (
                  <PlayIcon className="h-8 w-8" />
                )}
              </button>

              <div className="flex-1 mx-4">
                <div className="flex items-center">
                  <button
                    onClick={toggleMute}
                    className="p-2 text-gray-700 dark:text-gray-300 hover:text-maroon-600 dark:hover:text-maroon-400"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
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
                    className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-maroon-600 dark:accent-maroon-500"
                    aria-label="Volume"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 min-w-[2.5rem] text-right">
                    {volume}%
                  </span>
                </div>
              </div>
            </div>

            {/* Next Broadcast Info (if not live) */}
            {!isLive && nextBroadcast && (
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Next Broadcast</h3>
                <p className="text-base font-semibold text-gray-900 dark:text-white">{nextBroadcast.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {nextBroadcast.date} at {nextBroadcast.time}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rest of your dashboard code (tabs, chat, song requests, etc.) */}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="p-6">
          {/* Tabs for Chat, Song Requests, and Polls */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
            <button
              onClick={() => setActiveTab("chat")}
              className={`py-2 px-4 text-sm font-medium rounded-t-lg ${
                activeTab === "chat"
                  ? "bg-maroon-100 text-maroon-800 dark:bg-maroon-900 dark:text-maroon-200 border-b-2 border-maroon-500"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              <div className="flex items-center">
                <ChatBubbleLeftRightIcon className="h-4 w-4 mr-2" />
                Chat
              </div>
            </button>

            <button
              onClick={() => setActiveTab("request")}
              className={`py-2 px-4 text-sm font-medium rounded-t-lg ${
                activeTab === "request"
                  ? "bg-maroon-100 text-maroon-800 dark:bg-maroon-900 dark:text-maroon-200 border-b-2 border-maroon-500"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              <div className="flex items-center">
                <MusicalNoteIcon className="h-4 w-4 mr-2" />
                Song Requests
              </div>
            </button>
          </div>

          {/* Content based on active tab */}
          <div className="mt-4">
            {activeTab === "chat" && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Live Chat</h3>
                {renderChatMessages()}
                <form onSubmit={handleChatSubmit} className="flex items-center">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type a message..."
                    disabled={!isLive || !currentBroadcastId}
                    className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-l-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent disabled:bg-gray-100 disabled:dark:bg-gray-800 disabled:cursor-not-allowed"
                  />
                  <button
                    type="submit"
                    disabled={!isLive || !currentBroadcastId}
                    className="p-2 bg-maroon-600 text-white rounded-r-md hover:bg-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    <PaperAirplaneIcon className="h-5 w-5" />
                  </button>
                </form>
                {!isLive && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
                    Chat is only available during live broadcasts
                  </p>
                )}
              </div>
            )}

            {activeTab === "request" && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Request a Song</h3>
                <form onSubmit={handleSongRequestSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="song" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Song Title
                    </label>
                    <input
                      type="text"
                      id="song"
                      value={songRequest.song}
                      onChange={(e) => setSongRequest({ ...songRequest, song: e.target.value })}
                      placeholder="Enter song title"
                      disabled={!isLive || !currentBroadcastId}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent disabled:bg-gray-100 disabled:dark:bg-gray-800 disabled:cursor-not-allowed"
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
                      onChange={(e) => setSongRequest({ ...songRequest, artist: e.target.value })}
                      placeholder="Enter artist name"
                      disabled={!isLive || !currentBroadcastId}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent disabled:bg-gray-100 disabled:dark:bg-gray-800 disabled:cursor-not-allowed"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!isLive || !currentBroadcastId}
                    className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-maroon-600 hover:bg-maroon-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Submit Request
                  </button>
                  {!isLive && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
                      Song requests are only available during live broadcasts
                    </p>
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
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
