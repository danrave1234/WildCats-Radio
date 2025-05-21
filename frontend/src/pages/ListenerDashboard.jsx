"use client"

import { useState, useEffect, useRef } from "react"
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
import { broadcastService, chatService, songRequestService, streamService, pollService } from "../services/api"

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

  // Store stream status for debugging 
  const [streamStatusDebug, setStreamStatusDebug] = useState(null);

  // Initialize audio player and fetch stream status
  useEffect(() => {
    // Create audio element if it doesn't exist
    if (!audioRef.current) {
      console.log("Creating new audio element");
      audioRef.current = new Audio();
      
      // Configure audio element before setting src
      audioRef.current.preload = "auto";
      audioRef.current.crossOrigin = "anonymous";
      audioRef.current.volume = volume / 100;

      // Set up event listeners before setting src
      // Handle successful loading of audio
      const handleCanPlay = () => {
        console.log("Audio can play now");
        setStreamError(null);
        
        // Automatically start playback if it was previously playing
        if (isPlaying && audioRef.current && audioRef.current.paused) {
          audioRef.current.play()
            .catch(playError => {
              console.error("Playback failed:", playError);
              setIsPlaying(false);
              setStreamError(`Couldn't start playback: ${playError.message}`);
            });
        }
      };

      // Handle audio errors
      const handleError = (e) => {
        console.error('Audio error:', e);

        // Check if there's a specific error code
        const mediaError = e.target?.error;
        if (mediaError) {
          console.error('Media error code:', mediaError.code, 'Media error message:', mediaError.message);

          // Provide more specific error messages based on the error code
          switch (mediaError.code) {
            case MediaError.MEDIA_ERR_ABORTED:
              setStreamError('Playback was aborted. Please try again.');
              break;
            case MediaError.MEDIA_ERR_NETWORK:
              setStreamError('A network error occurred. Please check your connection and try again.');
              break;
            case MediaError.MEDIA_ERR_DECODE:
              setStreamError('The audio could not be decoded. The stream may be corrupted or in an unsupported format.');
              break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              // Only show this error if we're not using the default empty audio
              if (audioRef.current.src !== "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=") {
                setStreamError('The audio format is not supported or the stream is not available. The DJ may be setting up the stream.');
              }
              break;
            default:
              setStreamError('Error loading stream. Please try again.');
          }
        } else {
          setStreamError('Error loading stream. Please try again.');
        }

        setIsPlaying(false);

        // Try to reconnect if the stream fails and we have a valid stream URL
        if (reconnectAttempts < 3 && streamUrl && streamUrl !== "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=") {
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            console.log(`Attempting reconnect ${reconnectAttempts + 1}/3`);
            if (audioRef.current) {
              loadAudioSource(streamUrl);
            }
          }, 3000);
        } else if (reconnectAttempts >= 3) {
          console.warn("Maximum reconnect attempts reached");
          // Ensure we have at least the silent audio loaded to prevent "Empty src attribute" errors
          if (audioRef.current) {
            audioRef.current.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
            audioRef.current.load();
          }
        }
      };

      const handlePlaying = () => {
        setIsPlaying(true);
        console.log('Stream is playing');
      };

      const handlePause = () => {
        setIsPlaying(false);
        console.log('Stream is paused');
      };

      const handleEnded = () => {
        setIsPlaying(false);
        console.log('Stream ended');
      };

      // Add event listeners
      audioRef.current.addEventListener('playing', handlePlaying);
      audioRef.current.addEventListener('pause', handlePause);
      audioRef.current.addEventListener('ended', handleEnded);
      audioRef.current.addEventListener('error', handleError);
      audioRef.current.addEventListener('canplay', handleCanPlay);

      // Set a default src to prevent "Empty src attribute" errors - AFTER event listeners
      audioRef.current.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
      
      // Explicitly call load() to ensure the audio element processes the src change
      audioRef.current.load();
      console.log("Initial silent audio loaded");
      
      // Store handlers for cleanup
      audioRef.eventHandlers = {
        playing: handlePlaying,
        pause: handlePause,
        ended: handleEnded,
        error: handleError,
        canplay: handleCanPlay
      };
    }

    return () => {
      // Clean up audio element and audio context when component unmounts
      if (audioRef.current) {
        // Remove event listeners
        if (audioRef.eventHandlers) {
          Object.entries(audioRef.eventHandlers).forEach(([event, handler]) => {
            audioRef.current.removeEventListener(event, handler);
          });
        }
        
        // Stop playback and release resources
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
        audioRef.current = null;
        audioRef.eventHandlers = null;
      }

      if (audioContext) {
        audioContext.close();
      }

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []); // Empty dependency array to run only once during component mount

  // Update volume when the volume state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Check if a broadcast is live and set up the stream URL
  useEffect(() => {
    const checkBroadcastStatus = async () => {
      try {
        console.log("Checking broadcast status...");
        // Fetch stream status from the API
        const statusResponse = await streamService.getStatus();
        const status = statusResponse.data;
        
        // Store the full status for debugging
        window.lastStreamStatus = status;
        setStreamStatusDebug(status);
        
        // Log important diagnostic information
        if (status.broadcast && !status.isActive) {
          console.warn("Broadcast exists but is not fully active:", status);
          console.warn("Server status:", status.server);
          console.warn("Streaming status:", status.streaming);
          console.warn("Live status:", status.live);
          console.warn("Overall active status:", status.isActive);
          
          if (status.streamingDisabledReason) {
            console.warn("Streaming disabled reason:", status.streamingDisabledReason);
          }
        }

        // Only consider a broadcast truly live if both database status is live AND streaming is active AND server is up
        const isBroadcastActive = status.isActive === true; // Use server's computed value
        
        // Update live status
        setIsLive(isBroadcastActive);

        // Only show broadcast info and attempt to connect if all conditions are met
        if (isBroadcastActive && status.broadcast) {
          setCurrentBroadcastId(status.broadcast.id);
          console.log("Broadcast info:", status.broadcast);
          setStreamError(null); // Clear any previous errors

          try {
            // Get the listener stream URL through our proxy endpoint
            const proxyStreamUrl = await streamService.getListenerStreamUrl('mp3');
            
            // Validate the stream URL
            if (!proxyStreamUrl) {
              throw new Error("Received empty stream URL from server");
            }
            
            console.log("Stream URL received:", proxyStreamUrl);
            setStreamUrl(proxyStreamUrl);
            
            // Set up audio player source with proxy URL
            if (audioRef.current) {
              loadAudioSource(proxyStreamUrl);
            }
          } catch (error) {
            console.error("Error getting stream URL:", error);
            setStreamError("Failed to get stream URL: " + error.message);
            
            // Reset to silent audio on error
            if (audioRef.current) {
              audioRef.current.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
              audioRef.current.load();
            }
          }
        } else {
          // Handle non-active broadcast situations
          setIsLive(false);
          
          // If the broadcast info exists but stream isn't active, still show the ID but don't try to connect
          if (status.broadcast) {
            console.log("Broadcast exists but not active:", status.broadcast.id);
            setCurrentBroadcastId(status.broadcast.id);
          } else {
            setCurrentBroadcastId(null);
          }
          
          // If audio is playing, stop it
          if (audioRef.current && !audioRef.current.paused) {
            audioRef.current.pause();
          }
          
          // Set appropriate user message
          if (status.broadcast && !status.isActive) {
            // More specific error message based on server response
            if (status.streamingDisabledReason) {
              setStreamError(`Broadcast cannot be played: ${status.streamingDisabledReason}`);
            } else if (status.live && status.server === "UP" && !status.streaming) {
              setStreamError("Broadcast is marked as live, but no audio stream is available. The DJ may be setting up the stream.");
            } else if (status.server !== "UP") {
              setStreamError("Streaming server is not running at the moment.");
            } else {
              setStreamError("Broadcast exists but is not actively streaming.");
            }
          } else {
            setStreamError("No live broadcast is currently available.");
          }
          
          // Make sure we have silent audio loaded to prevent "Empty src attribute" errors
          if (audioRef.current) {
            audioRef.current.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
            audioRef.current.load();
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
            setNextBroadcast(null);
          }
        }
      } catch (error) {
        console.error("Error checking broadcast status:", error);
        setIsLive(false);
        setStreamError("Error checking broadcast status: " + error.message);
      }
    };

    // Check broadcast status immediately
    checkBroadcastStatus();

    // Setup WebSocket fallback protection - if subscription fails, use polling
    let statusCheckInterval;
    let wsSubscription;
    
    const setupWebSocketOrFallback = () => {
      try {
        console.log("Setting up WebSocket subscription for stream status updates");
        
        // Subscribe to WebSocket updates for real-time status changes
        wsSubscription = streamService.subscribeToStreamStatus((status) => {
          // When we receive a WebSocket update, check broadcast status again
          console.log("Received WebSocket status update:", status);
          checkBroadcastStatus();
        });
        
        // Set up a less frequent backup polling just in case
        statusCheckInterval = setInterval(checkBroadcastStatus, 30000); // 30 seconds backup poll
      } catch (error) {
        console.error("Error setting up WebSocket, using polling fallback:", error);
        
        // If WebSocket setup fails, fall back to more frequent polling
        statusCheckInterval = setInterval(checkBroadcastStatus, 5000); // 5 seconds fallback poll
      }
    };
    
    setupWebSocketOrFallback();
    
    // Clean up function
    return () => {
      // Clear any polling intervals
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
      
      // Clean up WebSocket subscription
      if (wsSubscription && typeof wsSubscription.disconnect === 'function') {
        try {
          console.log("Cleaning up WebSocket subscription");
          wsSubscription.disconnect();
        } catch (error) {
          console.warn("Error during WebSocket disconnect:", error);
        }
      }
    };
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

  // Function to safely load a new audio source
  const loadAudioSource = (url) => {
    if (!audioRef.current) return;
    
    try {
      // If URL is empty or undefined, set to a silent audio source and return
      if (!url || url === 'undefined') {
        console.log("Received empty URL, setting silent audio source");
        audioRef.current.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
        audioRef.current.load();
        return;
      }
      
      // Check if the URL is the same as the current one to avoid unnecessary reloads
      if (audioRef.current.src === url) {
        console.log("Audio source already set to the provided URL, skipping reload");
        return;
      }
      
      console.log("Loading new audio source via proxy:", url);
      
      // Reset any error state
      setStreamError(null);
      
      // Set audio metadata - using proxy endpoint doesn't need cors
      audioRef.current.crossOrigin = null;
      audioRef.current.type = "audio/mpeg";
      
      // Set new audio source and load it
      audioRef.current.src = url;
      audioRef.current.load();
      
      console.log("Stream URL set:", url);
      
      // If we're supposed to be playing, attempt to play
      if (isPlaying) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Error auto-playing after source change:", error);
            setIsPlaying(false);
            
            // Check if this is an autoplay policy error
            if (error.name === 'NotAllowedError') {
              setStreamError("Autoplay blocked by browser. Please click play to listen.");
              // Show the autoplay notice
              const notice = document.getElementById('autoplay-notice');
              if (notice) {
                notice.classList.remove('hidden');
                notice.classList.add('flex');
              }
            }
          });
        }
      }
    } catch (error) {
      console.error("Error setting audio source:", error);
      setStreamError(`Error loading audio stream: ${error.message}`);
      setIsPlaying(false);
      
      // Reset to silent audio on critical error
      audioRef.current.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
      audioRef.current.load();
    }
  };

  // Toggle play/pause for the audio stream
  const togglePlay = async () => {
    if (!audioRef.current) return;
    
    try {
      if (isPlaying) {
        // Pause the audio
        audioRef.current.pause();
        setIsPlaying(false);
        return;
      }
      
      if (!isLive) {
        setStreamError("No live broadcast available at the moment.");
        return;
      }
      
      setStreamError(null); // Clear any existing errors before attempting to play
      
      // Check if we have a valid audio source
      const currentSrc = audioRef.current.src;
      const isSilentAudio = currentSrc === "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
      
      // If we have no stream URL or we're still using the silent audio placeholder
      if (!streamUrl || streamUrl === "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=" || 
          isSilentAudio || !currentSrc || currentSrc === '') {
        console.log("No valid stream URL, requesting a new one");
        
        try {
          const newStreamUrl = await streamService.getListenerStreamUrl('mp3');
          if (newStreamUrl) {
            setStreamUrl(newStreamUrl);
            loadAudioSource(newStreamUrl);
            
            // We need to wait for the audio to be ready before playing
            audioRef.current.oncanplay = () => {
              audioRef.current.play()
                .catch(playError => {
                  console.error("Error playing after loading new source:", playError);
                  setStreamError(`Couldn't start playback: ${playError.message}`);
                  setIsPlaying(false);
                });
              // Remove one-time handler
              audioRef.current.oncanplay = null;
            };
            
            return; // Early return since we've set up the oncanplay handler
          } else {
            setStreamError("Failed to get stream URL. Please try again later.");
            return;
          }
        } catch (error) {
          console.error("Error getting stream URL:", error);
          setStreamError("Error connecting to stream. Please try again later.");
          return;
        }
      }
      
      // Hide autoplay notice if it's visible
      const notice = document.getElementById('autoplay-notice');
      if (notice) {
        notice.classList.add('hidden');
        notice.classList.remove('flex');
      }
      
      // Attempt to play the audio
      try {
        console.log("Attempting to play audio with source:", audioRef.current.src);
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log("Audio playing successfully");
            setIsPlaying(true);
          }).catch((error) => {
            console.error("Error playing audio:", error);
            
            if (error.name === "NotAllowedError") {
              // Autoplay policy error
              setStreamError("Browser blocked autoplay. Please click play again.");
            } else if (error.name === "AbortError" || error.message.includes("The element has no supported sources")) {
              // Source issue - try to get a new URL
              console.log("Source error, trying to get a new stream URL");
              
              setTimeout(async () => {
                try {
                  const refreshedUrl = await streamService.getListenerStreamUrl('mp3');
                  if (refreshedUrl) {
                    console.log("Trying with refreshed URL:", refreshedUrl);
                    setStreamUrl(refreshedUrl);
                    loadAudioSource(refreshedUrl);
                  }
                } catch (retryError) {
                  console.error("Error getting refreshed stream URL:", retryError);
                }
              }, 1000);
            } else {
              // Other playback error
              setStreamError(`Error playing stream: ${error.message}`);
              
              // Try one more time with a new stream URL after a short delay
              setTimeout(async () => {
                try {
                  const refreshedUrl = await streamService.getListenerStreamUrl('mp3');
                  if (refreshedUrl) {
                    console.log("Trying with refreshed URL:", refreshedUrl);
                    setStreamUrl(refreshedUrl);
                    loadAudioSource(refreshedUrl);
                  }
                } catch (retryError) {
                  console.error("Error getting refreshed stream URL:", retryError);
                }
              }, 2000);
            }
          });
        }
      } catch (error) {
        console.error("Error in play attempt:", error);
        setStreamError(`Playback error: ${error.message}`);
        setIsPlaying(false);
      }
    } catch (error) {
      console.error("Toggle play error:", error);
      setStreamError(`Player error: ${error.message}`);
      setIsPlaying(false);
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

  // Show notification to help users with browsers that restrict autoplay
  useEffect(() => {
    // Check if we need to show autoplay notice
    const showAutoplayNotice = () => {
      // Only show if we have a stream URL and it's live but not playing
      if (isLive && streamUrl && !isPlaying && !streamError) {
        // Add a delayed notification about needing to click play
        const timer = setTimeout(() => {
          const notice = document.getElementById('autoplay-notice');
          if (notice) {
            notice.classList.remove('hidden');
            notice.classList.add('flex');
          }
        }, 2000); // Show after 2 seconds
        
        return () => clearTimeout(timer);
      }
    };

    // Call the function
    const cleanup = showAutoplayNotice();
    
    // Clean up
    return () => {
      if (cleanup) cleanup();
    };
  }, [isLive, streamUrl, isPlaying, streamError]);

  // Function to dismiss the autoplay notice
  const dismissAutoplayNotice = () => {
    const notice = document.getElementById('autoplay-notice');
    if (notice) {
      notice.classList.add('hidden');
      notice.classList.remove('flex');
    }
  };

  // New function to render debug information
  const renderDebugInfo = () => {
    if (!streamStatusDebug || !streamStatusDebug.broadcast || streamStatusDebug.isActive) {
      return null;
    }
    
    return (
      <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-md text-sm">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium text-yellow-800 dark:text-yellow-300">Broadcast Status Debug</h3>
          <button 
            onClick={() => window.location.reload()} 
            className="px-2 py-1 bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded text-xs"
          >
            Refresh Page
          </button>
        </div>
        
        <ul className="space-y-1 text-yellow-700 dark:text-yellow-300">
          <li><span className="font-medium">Broadcast ID:</span> {streamStatusDebug.broadcast.id}</li>
          <li><span className="font-medium">Title:</span> {streamStatusDebug.broadcast.title}</li>
          <li><span className="font-medium">Status:</span> {streamStatusDebug.broadcast.status}</li>
          <li><span className="font-medium">Start Time:</span> {new Date(streamStatusDebug.broadcast.startTime).toLocaleString()}</li>
          <li><span className="font-medium">Server Status:</span> {streamStatusDebug.server}</li>
          <li><span className="font-medium">Live Flag:</span> {streamStatusDebug.live ? 'True' : 'False'}</li>
          <li><span className="font-medium">Streaming:</span> {streamStatusDebug.streaming ? 'True' : 'False'}</li>
          <li><span className="font-medium">Is Active:</span> {streamStatusDebug.isActive ? 'True' : 'False'}</li>
          {streamStatusDebug.streamingDisabledReason && (
            <li><span className="font-medium">Disabled Reason:</span> {streamStatusDebug.streamingDisabledReason}</li>
          )}
          {streamStatusDebug.broadcastIsRecent !== undefined && (
            <li><span className="font-medium">Is Recent:</span> {streamStatusDebug.broadcastIsRecent ? 'Yes' : 'No'}</li>
          )}
        </ul>
        
        <p className="mt-3 text-xs text-yellow-600 dark:text-yellow-400">
          If the broadcast shows 'LIVE' status but isn't streaming, please contact your DJ or administrator.
          This debug information can help them diagnose the issue.
        </p>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
        Listener Dashboard
      </h1>

      <div className="max-w-4xl mx-auto">
        {/* Player Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Live Stream</h2>
            
            {/* Debug Information */}
            {renderDebugInfo()}
            
            {/* Player Controls */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={togglePlay}
                  disabled={!isLive && !isPlaying}
                  className={`w-12 h-12 flex items-center justify-center rounded-full focus:outline-none ${
                    isPlaying
                      ? 'bg-maroon-600 hover:bg-maroon-700 text-white'
                      : isLive
                      ? 'bg-maroon-500 hover:bg-maroon-600 text-white'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                </button>
                
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {isLive ? 'Live Now' : 'Not Live'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {currentBroadcastId
                      ? `Broadcast #${currentBroadcastId}`
                      : 'No active broadcast'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleMute}
                  className="p-2 text-gray-700 dark:text-gray-300 focus:outline-none"
                >
                  {isMuted ? (
                    <SpeakerXMarkIcon className="w-6 h-6" />
                  ) : (
                    <SpeakerWaveIcon className="w-6 h-6" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-24 accent-maroon-500"
                />
              </div>
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
    </div>
  )
}
