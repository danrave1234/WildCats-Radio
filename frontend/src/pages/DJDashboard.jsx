"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import {
  MicrophoneIcon,
  StopIcon,
  PlusIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  CheckIcon,
} from "@heroicons/react/24/solid"
import {
  ChatBubbleLeftRightIcon,
  MusicalNoteIcon,
  ChartBarIcon,
  PaperAirplaneIcon,
  UserIcon,
  HeartIcon,
  ArrowDownTrayIcon,
  SpeakerWaveIcon,
} from "@heroicons/react/24/outline"
import { broadcastService, songRequestService, pollService, authService, chatService, radioService } from "../services/api/index.js"
import stompClientManager from "../services/stompClientManager"
import { useAuth } from "../context/AuthContext"
import { useStreaming } from "../context/StreamingContext"
import { format, formatDistanceToNow } from "date-fns"
import AudioPlayer from "../components/AudioPlayer"
import { EnhancedScrollArea } from "../components/ui/enhanced-scroll-area"
import { createLogger } from "../services/logger"
import { profanityService } from "../services/api"
import EnhancedScheduleForm from "../components/EnhancedScheduleForm"
import { CalendarIcon } from "@heroicons/react/24/outline"
import { getBroadcastErrorMessage, handleStateMachineError } from "../utils/errorHandler"
import DJHandoverModal from "../components/DJHandover/DJHandoverModal"
import SuccessNotification from "../components/SuccessNotification"
import { broadcastApi } from "../services/api/broadcastApi"
import ReadOnlyView from "../components/ReadOnlyView"
import Toast from "../components/Toast"
import { LockClosedIcon } from "@heroicons/react/24/solid"

const logger = createLogger("DJDashboard")

function ProfanityManager() {
  const [words, setWords] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    profanityService.listWords()
      .then((data) => { if (mounted) setWords(data || []); })
      .catch((e) => { if (mounted) setError(e?.response?.data?.message || e.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const addWord = async (e) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    const w = (newWord || '').trim();
    if (!w) return;
    try {
      setLoading(true);
      const res = await profanityService.addWord(w);
      setWords((prev) => prev.includes(w.toLowerCase()) ? prev : [...prev, w.toLowerCase()]);
      setNewWord('');
      setSuccess(res?.message || 'Added');
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 p-4 border rounded-lg bg-white dark:bg-gray-900">
      <h3 className="text-lg font-semibold mb-2">Profanity Dictionary</h3>
      <form onSubmit={addWord} className="flex gap-2 mb-3">
        <input
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          placeholder="Add new word or phrase"
          className="flex-1 border rounded px-3 py-2 bg-white dark:bg-gray-800"
        />
        <button disabled={loading} className="px-4 py-2 bg-maroon-600 text-white rounded hover:bg-maroon-700 disabled:opacity-50">
          Add
        </button>
      </form>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      {success && <div className="text-sm text-green-600 mb-2">{success}</div>}
      <div className="max-h-40 overflow-auto border rounded p-2 bg-gray-50 dark:bg-gray-800">
        {loading ? (
          <div>Loading...</div>
        ) : words.length === 0 ? (
          <div className="text-sm text-gray-500">No custom words yet.</div>
        ) : (
          <ul className="list-disc list-inside text-sm space-y-1">
            {words.sort().map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-2">Words are saved locally on the server and applied immediately to new chats.</p>
    </div>
  );
}

// Broadcast workflow states
const WORKFLOW_STATES = {
  CREATE_BROADCAST: "CREATE_BROADCAST",
  READY_TO_STREAM: "READY_TO_STREAM",
  STREAMING_LIVE: "STREAMING_LIVE",
}

export default function DJDashboard() {
  // Authentication context
  const { currentUser, handoverLogin, checkAuthStatus } = useAuth()

  // Check if user has proper role for DJ dashboard
  if (!currentUser || (currentUser.role !== 'DJ' && currentUser.role !== 'ADMIN')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">
              You need DJ or Admin privileges to access the DJ Dashboard.
            </p>
            <p className="text-sm text-gray-500">
              Current role: {currentUser?.role || 'Not authenticated'}
            </p>
            <div className="mt-4 text-sm text-gray-600">
              <p>To access the DJ Dashboard, you need:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>DJ role - to create and manage broadcasts</li>
                <li>Admin role - to access all features</li>
              </ul>
              <p className="mt-2">
                Contact an administrator to update your role, or log in with an account that has the proper privileges.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Streaming context
  const {
    isLive,
    currentBroadcast: contextBroadcast,
    websocketConnected,
    listenerCount,
    peakListenerCount,
    startBroadcast: startStreamingBroadcast,
    stopBroadcast: stopStreamingBroadcast,
    restoreDJStreaming,
    serverConfig,
    mediaRecorderRef,
    audioStreamRef,
    audioSource,
    setAudioSource,
    getAudioStream,
    streamStatusCircuitBreakerOpen,
    isBroadcastingDevice
  } = useStreaming()

  // Core workflow state
  const [workflowState, setWorkflowState] = useState(WORKFLOW_STATES.CREATE_BROADCAST)
  const [draftBroadcast, setDraftBroadcast] = useState(null)
  
  // Unified broadcast object (prefers context/live, falls back to local draft)
  const currentBroadcast = contextBroadcast || draftBroadcast

  // Broadcast creation form state
  const [broadcastForm, setBroadcastForm] = useState({
    title: "",
    description: "",
    isScheduled: false,
    scheduledDate: "",
    scheduledStartTime: "",
    scheduledEndTime: "",
  })
  const [formErrors, setFormErrors] = useState({})
  const [isCreatingBroadcast, setIsCreatingBroadcast] = useState(false)

  // Core streaming state
  const [streamError, setStreamError] = useState(null)
  const [isRestoringAudio, setIsRestoringAudio] = useState(false)
  const [isStoppingBroadcast, setIsStoppingBroadcast] = useState(false)
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false)
  const [showHandoverModal, setShowHandoverModal] = useState(false)
  const [showSuccessNotification, setShowSuccessNotification] = useState(false)
  const [successNotificationMessage, setSuccessNotificationMessage] = useState('')
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 })
  // Grace period to suppress transient unhealthy/isLive=false immediately after going live
  const [graceUntilMs, setGraceUntilMs] = useState(0)
  
  // Toast state
  const [toastState, setToastState] = useState({ show: false, message: '', type: 'success' })
  const showToast = (message, type = 'success') => {
    setToastState({ show: true, message, type })
  }

  // WebSocket and MediaRecorder refs
  const websocketRef = useRef(null)
  const statusWsRef = useRef(null)
  const settingsDropdownRef = useRef(null)
  const settingsButtonRef = useRef(null)

  // Constants from prototype
  const MAX_MESSAGE_SIZE = 60000

  // No longer needed - interactions are directly in main dashboard when live
  // Chat State
  const [chatMessages, setChatMessages] = useState([])
  const [chatMessage, setChatMessage] = useState("")
  const [isDownloadingChat, setIsDownloadingChat] = useState(false)
  const [showScrollBottom, setShowScrollBottom] = useState(false)

  // Song Requests State
  const [songRequests, setSongRequests] = useState([])
  // Helper: derive best-effort sent time for a song request
  const getSongRequestTimeMs = (request, isIncoming = false) => {
    try {
      const raw = request?.timestamp ?? request?.createdAt
      const parsed = raw ? new Date(raw) : null
      const parsedMs = parsed && !isNaN(parsed.getTime()) ? parsed.getTime() : NaN
      if (isIncoming) {
        if (!parsedMs || Math.abs(Date.now() - parsedMs) > 1000 * 60 * 60 * 4) {
          return Date.now()
        }
      }
      return parsedMs || Date.now()
    } catch (_) {
      return Date.now()
    }
  }

  // Poll Creation State
  const [newPoll, setNewPoll] = useState({
    question: "",
    options: ["", ""],
  })
  const [isCreatingPoll, setIsCreatingPoll] = useState(false)

  // Slow mode state
  const [slowModeEnabled, setSlowModeEnabled] = useState(false)
  const [slowModeSeconds, setSlowModeSeconds] = useState(0)
  const [isSavingSlowMode, setIsSavingSlowMode] = useState(false)

  // Polls Display State
  const [polls, setPolls] = useState([])
  const [activePoll, setActivePoll] = useState(null)
  const [showPollCreation, setShowPollCreation] = useState(false)

  // WebSocket References for interactions
  const chatWsRef = useRef(null)
  const chatContainerRef = useRef(null)
  const songRequestWsRef = useRef(null)
  const pollWsRef = useRef(null)
  const reconnectionWsRef = useRef(null)

  // Add abort controller ref for managing HTTP requests
  const abortControllerRef = useRef(null)

  // Radio Agent State (Liquidsoap control)
  const [radioServerState, setRadioServerState] = useState("unknown") // "running" | "stopped" | "unknown"
  const [isStartingServer, setIsStartingServer] = useState(false)
  const [isStoppingServer, setIsStoppingServer] = useState(false)
  const [radioServerError, setRadioServerError] = useState(null)
  const radioStatusPollRef = useRef(null)
  const [isRecoveringBroadcast, setIsRecoveringBroadcast] = useState(false)

  // Analytics State
  const [broadcastStartTime, setBroadcastStartTime] = useState(null)
  const [lastCheckpointTime, setLastCheckpointTime] = useState(null)
  const [totalInteractions, setTotalInteractions] = useState(0)
  const [peakListeners, setPeakListeners] = useState(0)
  const [totalSongRequests, setTotalSongRequests] = useState(0)
  const [totalPolls, setTotalPolls] = useState(0)

  const [durationTick, setDurationTick] = useState(0)

  // Chat timestamp update state
  const [chatTimestampTick, setChatTimestampTick] = useState(0)

  // Radio Server Control Functions
  const fetchRadioStatus = async () => {
    try {
      const response = await radioService.status()
      const data = response?.data || {}
      const state = data.state || "unknown"
      
      logger.debug("Radio status fetched:", { 
        state, 
        fullResponse: data,
        timestamp: new Date().toISOString()
      })
      
      setRadioServerState(state)
      setRadioServerError(null)
    } catch (error) {
      logger.error("Failed to fetch radio server status:", error)
      logger.error("Error details:", {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error.message
      })
      setRadioServerState("unknown")
      setRadioServerError(error?.response?.data?.detail || "Failed to fetch status")
    }
  }

  const handleStartRadioServer = async () => {
    if (isStartingServer || radioServerState === "running") return
    
    try {
      setIsStartingServer(true)
      setRadioServerError(null)
      const response = await radioService.start()
      const data = response?.data || {}
      setRadioServerState(data.state || "running")
      logger.info("Radio server started successfully")
      // Immediately poll status to confirm
      await fetchRadioStatus()
    } catch (error) {
      logger.error("Failed to start radio server:", error)
      const detail = error?.response?.data?.detail || error.message || "Failed to start server"
      setRadioServerError(detail)
      setRadioServerState("unknown")
    } finally {
      setIsStartingServer(false)
    }
  }

  const handleStopRadioServer = async () => {
    if (isStoppingServer || radioServerState === "stopped") return
    
    try {
      setIsStoppingServer(true)
      setRadioServerError(null)
      const response = await radioService.stop()
      const data = response?.data || {}
      setRadioServerState(data.state || "stopped")
      logger.info("Radio server stopped successfully")
      // Immediately poll status to confirm
      await fetchRadioStatus()
    } catch (error) {
      logger.error("Failed to stop radio server:", error)
      const detail = error?.response?.data?.detail || error.message || "Failed to stop server"
      setRadioServerError(detail)
      setRadioServerState("unknown")
    } finally {
      setIsStoppingServer(false)
    }
  }

  // Update duration display every second when live
  useEffect(() => {
    let interval = null
    if (workflowState === WORKFLOW_STATES.STREAMING_LIVE && broadcastStartTime) {
      interval = setInterval(() => {
        // Force re-render by updating a tick counter
        setDurationTick((prev) => prev + 1)
      }, 1000)
    } else {
      setDurationTick(0)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [workflowState, broadcastStartTime])

  // Sync local state with streaming context
  useEffect(() => {
    if (contextBroadcast && isLive) {
      // Only go to live mode if both broadcast exists AND system reports live
      // This prevents auto-reverting to live mode after broadcasts end
      setWorkflowState(WORKFLOW_STATES.STREAMING_LIVE)
    } else if (!contextBroadcast && workflowState === WORKFLOW_STATES.STREAMING_LIVE) {
      // If no broadcast but we're still in live mode, go back to ready state
      setWorkflowState(WORKFLOW_STATES.READY_TO_STREAM)
    }
  }, [contextBroadcast, isLive])

  // Sync slow mode state from current broadcast
  useEffect(() => {
    if (currentBroadcast) {
      setSlowModeEnabled(!!currentBroadcast.slowModeEnabled)
      setSlowModeSeconds(typeof currentBroadcast.slowModeSeconds === 'number' ? currentBroadcast.slowModeSeconds : 0)
    } else {
      setSlowModeEnabled(false)
      setSlowModeSeconds(0)
    }
  }, [currentBroadcast?.id, currentBroadcast?.slowModeEnabled, currentBroadcast?.slowModeSeconds])

  // Check for existing active broadcast and radio server state on component mount
  // This enables recovery if the DJ refreshes the page or browser crashes during a live broadcast
  useEffect(() => {
    // Only run recovery if we have a user (authentication completed)
    if (!currentUser) {
      logger.debug("DJ Dashboard: Skipping recovery - user not authenticated yet")
      return
    }

    const checkActiveBroadcastAndServerState = async () => {
      try {
        logger.debug("DJ Dashboard: Checking for active broadcast and radio server state on mount")
        
        // Check both broadcast state and radio server state in parallel
        const [activeBroadcast, serverStatusResponse] = await Promise.all([
          broadcastService.getActiveBroadcast().catch((err) => {
            logger.debug("No active broadcast found or error:", err)
            return null
          }),
          radioService.status().catch((err) => {
            logger.debug("Radio status check failed:", err)
            return null
          })
        ])

        const serverState = serverStatusResponse?.data?.state || "unknown"
        setRadioServerState(serverState)
        
        logger.debug("DJ Dashboard: Recovery check results:", {
          broadcastFound: !!activeBroadcast,
          broadcastStatus: activeBroadcast?.status,
          serverState: serverState,
          streamingBroadcast: contextBroadcast?.id
        })

        // Check if we found an active broadcast that we should recover
        if (activeBroadcast) {
          logger.debug("DJ Dashboard: Found active broadcast:", activeBroadcast)
          
          // Check if broadcast is LIVE (not just SCHEDULED)
          if (activeBroadcast.status === 'LIVE') {
            logger.info("DJ Dashboard: 🔴 LIVE BROADCAST RECOVERED - Restoring to streaming dashboard")
            
            // Only show recovery notification if we're actually recovering (not initial load)
            setIsRecoveringBroadcast(true)
            
            setDraftBroadcast(activeBroadcast)
            setWorkflowState(WORKFLOW_STATES.STREAMING_LIVE)
            
            if (activeBroadcast.actualStart) {
              try {
                setBroadcastStartTime(new Date(activeBroadcast.actualStart))
              } catch (_e) {
                setBroadcastStartTime(new Date())
              }
            } else {
              setBroadcastStartTime(new Date())
            }
            
            // Hide recovery notification after 3 seconds
            setTimeout(() => {
              setIsRecoveringBroadcast(false)
            }, 3000)
          } else if (activeBroadcast.status === 'SCHEDULED') {
            // Broadcast exists but not started yet - go to READY_TO_STREAM
            logger.debug("DJ Dashboard: Broadcast is SCHEDULED, showing ready-to-stream state")
            setDraftBroadcast(activeBroadcast)
            setWorkflowState(WORKFLOW_STATES.READY_TO_STREAM)
          }
        } else {
          // Check for scheduled broadcasts matching current time
          try {
            const upcomingResponse = await broadcastService.getUpcoming()
            const upcomingBroadcasts = upcomingResponse.data || []
            
            const now = new Date()
            const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)
            
            const matchingBroadcast = upcomingBroadcasts.find(broadcast => {
              if (!broadcast.scheduledStart) return false
              const scheduledStart = new Date(broadcast.scheduledStart)
              // Check if scheduled start is between now and 5 minutes from now
              return scheduledStart >= now && scheduledStart <= fiveMinutesFromNow
            })
            
            if (matchingBroadcast) {
              logger.info("DJ Dashboard: Found scheduled broadcast matching current time, using it:", matchingBroadcast)
              setDraftBroadcast(matchingBroadcast)
              setWorkflowState(WORKFLOW_STATES.READY_TO_STREAM)
            } else {
              logger.debug("DJ Dashboard: No active or matching scheduled broadcast found, staying on CREATE_BROADCAST")
            }
          } catch (error) {
            logger.debug("DJ Dashboard: Error checking for scheduled broadcasts:", error)
            logger.debug("DJ Dashboard: No active broadcast found, staying on CREATE_BROADCAST")
          }
        }
      } catch (error) {
        logger.error("DJ Dashboard: Error checking for active broadcast and server state:", error)
      }
    }

    // Always check for active broadcasts when user is authenticated
    // Don't depend on contextBroadcast since it might be null during recovery
    checkActiveBroadcastAndServerState()
  }, [currentUser]) // Only depend on currentUser, not contextBroadcast

  // Track analytics when streaming starts
  useEffect(() => {
    if (workflowState === WORKFLOW_STATES.STREAMING_LIVE && !broadcastStartTime) {
      if (currentBroadcast?.actualStart) {
        try {
          setBroadcastStartTime(new Date(currentBroadcast.actualStart))
        } catch (_e) {
          setBroadcastStartTime(new Date())
        }
      } else {
        // Fallback if backend start not yet propagated
        setBroadcastStartTime(new Date())
      }
    }
  }, [workflowState, broadcastStartTime, currentBroadcast?.actualStart])

  // Track peak listeners
  useEffect(() => {
    if (listenerCount > peakListeners) {
      setPeakListeners(listenerCount)
    }
  }, [listenerCount, peakListeners])

  // Sync with server-provided peak listener count (from StreamingContext)
  useEffect(() => {
    if (typeof peakListenerCount === 'number' && peakListenerCount > peakListeners) {
      setPeakListeners(peakListenerCount)
    }
  }, [peakListenerCount, peakListeners])

  // Track total interactions
  useEffect(() => {
    setTotalInteractions(chatMessages.length + songRequests.length + totalPolls)
  }, [chatMessages.length, songRequests.length, totalPolls])

  // Track song requests count
  useEffect(() => {
    setTotalSongRequests(songRequests.length)
  }, [songRequests.length])

  // Update chat timestamps every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setChatTimestampTick((prev) => prev + 1)
    }, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  // Radio Server Status Polling (fallback only - WebSocket provides real-time updates via StreamingContext)
  useEffect(() => {
    // If global streaming WebSocket is connected, rely on that for radio status
    if (websocketConnected) {
      if (radioStatusPollRef.current) {
        clearInterval(radioStatusPollRef.current)
        radioStatusPollRef.current = null
      }
      return
    }

    // Fetch initial status when WebSocket is not connected
    fetchRadioStatus()

    // Set up less aggressive polling interval as ultimate fallback
    radioStatusPollRef.current = setInterval(() => {
      fetchRadioStatus()
    }, 60000) // Poll every 60 seconds instead of 10 seconds

    return () => {
      if (radioStatusPollRef.current) {
        clearInterval(radioStatusPollRef.current)
        radioStatusPollRef.current = null
      }
    }
  }, [websocketConnected])

  // Replace the connectStatusWebSocket useEffect with a simpler version that doesn't create its own WebSocket
  useEffect(() => {
    logger.debug("DJ Dashboard: Using global streaming context for WebSocket connections")
    return () => {
      logger.debug("DJ Dashboard: Cleaning up, global streaming context will maintain connections")
    }
  }, [])

  // Close settings dropdown when clicking outside
  useEffect(() => {
    if (!showSettingsDropdown) return

    const handleClickOutside = (event) => {
      const dropdownEl = document.querySelector('[data-settings-dropdown]')
      const buttonEl = settingsButtonRef.current
      
      if (dropdownEl && buttonEl && 
          !dropdownEl.contains(event.target) && 
          !buttonEl.contains(event.target)) {
        setShowSettingsDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSettingsDropdown])

  // Fetch initial data when broadcast becomes available
  useEffect(() => {
    // Guard: Only fetch if we have a valid broadcast and are in streaming state
    if (workflowState !== WORKFLOW_STATES.STREAMING_LIVE || !currentBroadcast || !currentBroadcast.id) {
      // Clear interaction data when not live or no valid broadcast
      setChatMessages([])
      setSongRequests([])
      setPolls([])
      setActivePoll(null)
      return
    }

    const fetchInitialData = async () => {
      try {
        // Cancel any previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }

        // Create new abort controller for this request
        abortControllerRef.current = new AbortController()
        const signal = abortControllerRef.current.signal

        logger.debug("DJ Dashboard: Fetching initial interaction data for broadcast:", currentBroadcast.id)

        // Clear old data immediately when switching broadcasts
        setChatMessages([])
        setSongRequests([])
        setPolls([])
        setActivePoll(null)

        // Fetch chat messages
        const chatResponse = await chatService.getMessages(currentBroadcast.id)
        logger.debug("DJ Dashboard: Loaded initial chat messages:", chatResponse.data?.length || 0)

        // Double-check response is for current broadcast before setting state
        if (currentBroadcast?.id === currentBroadcast?.id && !signal.aborted) {
          setChatMessages(chatResponse.data || [])
        }

        // Fetch song requests
        const requestsResponse = await songRequestService.getRequests(currentBroadcast.id)
        logger.debug("DJ Dashboard: Loaded initial song requests:", requestsResponse.data?.length || 0)

        if (currentBroadcast?.id === currentBroadcast?.id && !signal.aborted) {
          const withDerivedTimes = (requestsResponse.data || [])
            .map(r => ({ ...r, _sentAt: getSongRequestTimeMs(r, false) }))
            .sort((a, b) => (b._sentAt || 0) - (a._sentAt || 0)) // newest first
          setSongRequests(withDerivedTimes)
        }

        // Fetch polls
        const pollsResponse = await pollService.getPollsForBroadcast(currentBroadcast.id)
        logger.debug("DJ Dashboard: Loaded initial polls:", pollsResponse.data?.length || 0)

        if (currentBroadcast?.id === currentBroadcast?.id && !signal.aborted) {
          // Fetch results for all polls (including ended ones) to preserve vote counts
          const pollsWithResults = await Promise.all(
            (pollsResponse.data || []).map(async (poll) => {
              try {
                const resultsResponse = await pollService.getPollResults(poll.id)
                return {
                  ...poll,
                  options: resultsResponse.data.options || poll.options,
                  totalVotes: resultsResponse.data.totalVotes || 0
                }
              } catch (error) {
                logger.debug("DJ Dashboard: Could not fetch results for poll:", poll.id, error)
                return poll
              }
            })
          )
          
          setPolls(pollsWithResults)

          // Set active poll: prefer the first active poll, otherwise the most recent ended poll with votes
          if (pollsWithResults.length > 0) {
            const activePolls = pollsWithResults.filter((p) => p.active)
            if (activePolls.length > 0) {
              setActivePoll(activePolls[0])
            } else {
              // Show most recent ended poll with votes
              const endedWithVotes = pollsWithResults
                .filter((p) => !p.active && (p.totalVotes > 0))
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
              if (endedWithVotes.length > 0) {
                setActivePoll(endedWithVotes[0])
              }
            }
          }
        }
      } catch (error) {
        // Ignore aborted requests
        if (error.name === "AbortError") {
          logger.debug("DJ Dashboard: Initial data fetch aborted for broadcast:", currentBroadcast.id)
          return
        }

        logger.error("DJ Dashboard: Error fetching initial interaction data:", error)
      }
    }

    fetchInitialData()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [workflowState, currentBroadcast?.id]) // Use currentBroadcast?.id to avoid running when currentBroadcast is null

  // Setup interaction WebSockets after initial data is loaded
  useEffect(() => {
    // Guard: Only setup WebSockets if we have a valid broadcast and are in streaming state
    if (workflowState !== WORKFLOW_STATES.STREAMING_LIVE || !currentBroadcast || !currentBroadcast.id) {
      return
    }

    logger.debug("DJ Dashboard: Setting up WebSocket connections for broadcast:", currentBroadcast.id)

    // Setup Chat WebSocket
    const setupChatWebSocket = async () => {
      try {
        // Clean up any existing connection first
        if (chatWsRef.current) {
          logger.debug("DJ Dashboard: Cleaning up existing chat WebSocket")
          chatWsRef.current.disconnect()
          chatWsRef.current = null
        }

        logger.debug("DJ Dashboard: Setting up chat WebSocket for broadcast:", currentBroadcast.id)

        const connection = await chatService.subscribeToChatMessages(currentBroadcast.id, (newMessage) => {
          // Double-check the message is for the current broadcast
          if (newMessage.broadcastId === currentBroadcast.id) {
            logger.debug("DJ Dashboard: Received new chat message:", newMessage)

            setChatMessages((prev) => {
              const exists = prev.some((msg) => msg.id === newMessage.id)
              if (exists) {
                logger.debug("DJ Dashboard: Message already exists, skipping")
                return prev
              }

              // Check if user was at bottom before adding message (for auto-scrolling)
              const wasAtBottom = isAtBottom(chatContainerRef.current);
              // Always scroll if it's the current user's message
              const isOwnMessage = currentUser && newMessage.userId === currentUser.id;

              const updated = [...prev, newMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

              // Auto-scroll logic:
              // - Always scroll if it's the user's own message
              // - Only scroll if user was already at bottom for other messages
              if (isOwnMessage || wasAtBottom) {
                setTimeout(() => {
                  scrollToBottom();
                  setShowScrollBottom(false);
                }, 50);
              }

              logger.debug("DJ Dashboard: Updated chat messages count:", updated.length)
              return updated
            })
          } else {
            logger.debug("DJ Dashboard: Ignoring message for different broadcast:", newMessage.broadcastId)
          }
        })

        chatWsRef.current = connection
        logger.debug("DJ Dashboard: Chat WebSocket connected successfully")
      } catch (error) {
        logger.error("DJ Dashboard: Failed to connect chat WebSocket:", error)
      }
    }

    // Setup Song Request WebSocket
    const setupSongRequestWebSocket = async () => {
      try {
        // Clean up any existing connection first
        if (songRequestWsRef.current) {
          logger.debug("DJ Dashboard: Cleaning up existing song request WebSocket")
          songRequestWsRef.current.disconnect()
          songRequestWsRef.current = null
        }

        logger.debug("DJ Dashboard: Setting up song request WebSocket for broadcast:", currentBroadcast.id)

        const connection = await songRequestService.subscribeToSongRequests(currentBroadcast.id, (message) => {
          // Normalize incoming payloads from WS
          const isDeletion = message?.type === "SONG_REQUEST_DELETED"
          if (isDeletion) {
            setSongRequests((prev) => prev.filter((req) => req.id !== message.requestId))
            return
          }

          // Possible shapes: { ...request }, { type: 'NEW', request: {...} }, { songRequest: {...} }
          const candidate = message?.request || message?.songRequest || message
          if (!candidate) return

          const broadcastId = candidate.broadcastId ?? message.broadcastId
          if (broadcastId !== currentBroadcast.id) return

          const id = candidate.id ?? candidate.requestId
          const normalized = { ...candidate, id }

          setSongRequests((prev) => {
            const exists = prev.some((req) => req.id === normalized.id)
            if (exists) return prev
            const enhanced = { ...normalized, _sentAt: getSongRequestTimeMs(normalized, true) }
            const updated = [enhanced, ...prev]
            updated.sort((a, b) => (b._sentAt || 0) - (a._sentAt || 0))
            return updated
          })
        })

        songRequestWsRef.current = connection
        logger.debug("DJ Dashboard: Song request WebSocket connected successfully")
      } catch (error) {
        logger.error("DJ Dashboard: Failed to connect song request WebSocket:", error)
      }
    }

    // Setup Poll WebSocket
    const setupPollWebSocket = async () => {
      try {
        // Clean up any existing connection first
        if (pollWsRef.current) {
          logger.debug("DJ Dashboard: Cleaning up existing poll WebSocket")
          pollWsRef.current.disconnect()
          pollWsRef.current = null
        }

        logger.debug("DJ Dashboard: Setting up poll WebSocket for broadcast:", currentBroadcast.id)

        const connection = await pollService.subscribeToPolls(currentBroadcast.id, (pollUpdate) => {
          logger.debug("DJ Dashboard: Received poll update:", pollUpdate)

          switch (pollUpdate.type) {
            case "POLL_VOTE":
              logger.debug("DJ Dashboard: Processing poll vote update for poll:", pollUpdate.pollId)

              // Update existing poll with new vote data
              setPolls((prev) =>
                  prev.map((poll) =>
                      poll.id === pollUpdate.pollId
                          ? {
                            ...poll,
                            options: pollUpdate.poll?.options || poll.options,
                            totalVotes: pollUpdate.poll?.totalVotes || poll.totalVotes,
                          }
                          : poll,
                  ),
              )

              // Update active poll if it's the one being voted on
              setActivePoll((prev) =>
                  prev && prev.id === pollUpdate.pollId
                      ? {
                        ...prev,
                        options: pollUpdate.poll?.options || prev.options,
                        totalVotes: pollUpdate.poll?.totalVotes || prev.totalVotes,
                      }
                      : prev,
              )
              break

            case "NEW_POLL":
              logger.debug("DJ Dashboard: Processing new poll:", pollUpdate.poll)

              // Fetch fresh results to ensure vote counts are accurate (for reposted polls)
              pollService.getPollResults(pollUpdate.poll.id)
                .then((resultsResponse) => {
                  const pollWithResults = {
                    ...pollUpdate.poll,
                    options: resultsResponse.data.options || pollUpdate.poll.options,
                    totalVotes: resultsResponse.data.totalVotes || 0
                  }
                  
                  // Add new poll to the list (or update if exists)
                  setPolls((prev) => {
                    const exists = prev.some((poll) => poll.id === pollWithResults.id)
                    if (exists) {
                      return prev.map((poll) => poll.id === pollWithResults.id ? pollWithResults : poll)
                    }
                    return [pollWithResults, ...prev]
                  })

                  setActivePoll(pollWithResults)
                })
                .catch((error) => {
                  logger.debug("DJ Dashboard: Could not fetch results for new poll, using poll data:", error)
                  // Fallback: use poll data directly
              setPolls((prev) => {
                const exists = prev.some((poll) => poll.id === pollUpdate.poll.id)
                if (exists) return prev
                return [pollUpdate.poll, ...prev]
              })
              setActivePoll(pollUpdate.poll)
                })
              break

            case "POLL_UPDATED":
              logger.debug("DJ Dashboard: Processing poll update:", pollUpdate.poll)

              if (pollUpdate.poll) {
                // Fetch fresh results to ensure vote counts are accurate
                pollService.getPollResults(pollUpdate.poll.id)
                  .then((resultsResponse) => {
                    const pollWithResults = {
                      ...pollUpdate.poll,
                      options: resultsResponse.data.options || pollUpdate.poll.options,
                      totalVotes: resultsResponse.data.totalVotes || 0
                    }
                    
                    // Update poll in list
                    setPolls((prev) =>
                        prev.map((poll) =>
                            poll.id === pollWithResults.id ? pollWithResults : poll
                        )
                    )
                    
                    // If this is the active poll, update it (but don't clear if ended - keep showing results)
                    setActivePoll((prev) => {
                      if (prev?.id === pollWithResults.id) {
                        return pollWithResults
                      }
                      return prev
                    })
                  })
                  .catch((error) => {
                    logger.debug("DJ Dashboard: Could not fetch results for updated poll, using poll data:", error)
                    // Fallback: use poll data directly (which includes vote counts from buildPollDTO)
                    setPolls((prev) =>
                        prev.map((poll) =>
                            poll.id === pollUpdate.poll.id ? pollUpdate.poll : poll
                        )
                    )
                    
                    setActivePoll((prev) => {
                      if (prev?.id === pollUpdate.poll.id) {
                        return pollUpdate.poll
                      }
                      return prev
                    })
                  })
              }
              break

            case "POLL_RESULTS":
              logger.debug("DJ Dashboard: Processing poll results update:", pollUpdate.results)

              if (pollUpdate.pollId && pollUpdate.results) {
                setPolls((prev) =>
                    prev.map((poll) =>
                        poll.id === pollUpdate.pollId
                            ? {
                              ...poll,
                              options: pollUpdate.results.options,
                              totalVotes: pollUpdate.results.totalVotes,
                            }
                            : poll,
                    ),
                )

                setActivePoll((prev) =>
                    prev && prev.id === pollUpdate.pollId
                        ? {
                          ...prev,
                          options: pollUpdate.results.options,
                          totalVotes: pollUpdate.results.totalVotes,
                        }
                        : prev,
                )
              }
              break

            default:
              logger.debug("DJ Dashboard: Unknown poll update type:", pollUpdate.type)
          }
        })

        pollWsRef.current = connection
        logger.debug("DJ Dashboard: Poll WebSocket connected successfully")
      } catch (error) {
        logger.error("DJ Dashboard: Failed to connect poll WebSocket:", error)
      }
    }

    // Setup Reconnection Status WebSocket
    const setupReconnectionWebSocket = async () => {
      try {
        // Clean up any existing connection first
        if (reconnectionWsRef.current) {
          logger.debug("DJDashboard: Cleaning up existing reconnection WebSocket")
          if (reconnectionWsRef.current.disconnect) reconnectionWsRef.current.disconnect()
          if (reconnectionWsRef.current.connection && reconnectionWsRef.current.connection.unsubscribe) {
            reconnectionWsRef.current.connection.unsubscribe()
          }
          reconnectionWsRef.current = null
        }

        logger.debug("DJ Dashboard: Setting up reconnection WebSocket for broadcast:", currentBroadcast.id)

        // Subscribe to broadcast-specific reconnection topic
        const connection = await broadcastService.subscribeToBroadcastUpdates(currentBroadcast.id, (message) => {
          if (message.type === "BROADCAST_RECOVERY") {
            logger.info("DJ Dashboard: Broadcast recovery notification received:", message)

            // Update broadcast state if provided
            if (message.broadcast) {
              setCurrentBroadcast(message.broadcast)
              if (message.broadcast.actualStart) {
                setBroadcastStartTime(new Date(message.broadcast.actualStart))
              }
            }
          }
        })

        // Also subscribe to global broadcast status topic for reconnection updates
        const globalConnection = await stompClientManager.subscribe("/topic/broadcast/status", (message) => {
          const data = JSON.parse(message.body)
          if (data.type === "BROADCAST_RECOVERY" && data.broadcastId === currentBroadcast.id) {
            logger.info("DJ Dashboard: Broadcast recovery notification received from global topic:", data)

            // Update broadcast state if provided
            if (data.broadcast) {
              setCurrentBroadcast(data.broadcast)
              if (data.broadcast.actualStart) {
                setBroadcastStartTime(new Date(data.broadcast.actualStart))
              }
            }
          }
        })

        // Subscribe to checkpoint updates (if backend supports it)
        const checkpointConnection = await stompClientManager.subscribe(
          `/topic/broadcast/${currentBroadcast.id}`,
          (message) => {
            const data = JSON.parse(message.body)

            if (data.type === 'BROADCAST_CHECKPOINT') {
              logger.debug('DJ Dashboard: Checkpoint update received:', data)

              // Update broadcast duration from backend checkpoint if provided
              if (data.currentDurationSeconds !== undefined) {
                const durationMs = data.currentDurationSeconds * 1000
                const checkpointStart = new Date(Date.now() - durationMs)
                setBroadcastStartTime(checkpointStart)
              }

              // Store last checkpoint time for display
              if (data.lastCheckpointTime) {
                setLastCheckpointTime(new Date(data.lastCheckpointTime))
              }
            }
          }
        )

        reconnectionWsRef.current = { connection, globalConnection, checkpointConnection }
        logger.debug("DJ Dashboard: Reconnection WebSocket connected successfully")
      } catch (error) {
        logger.error("DJ Dashboard: Failed to connect reconnection WebSocket:", error)
      }
    }

    // Setup WebSockets immediately - no delay needed with proper guards
    setupChatWebSocket()
    setupSongRequestWebSocket()
    setupPollWebSocket()
    setupReconnectionWebSocket()

    return () => {
      logger.debug("DJ Dashboard: Cleaning up WebSocket connections for broadcast:", currentBroadcast.id)

      if (chatWsRef.current) {
        chatWsRef.current.disconnect()
        chatWsRef.current = null
      }

      if (songRequestWsRef.current) {
        songRequestWsRef.current.disconnect()
        songRequestWsRef.current = null
      }

      if (pollWsRef.current) {
        pollWsRef.current.disconnect()
        pollWsRef.current = null
      }

      if (reconnectionWsRef.current) {
        if (reconnectionWsRef.current.connection && reconnectionWsRef.current.connection.unsubscribe) {
          reconnectionWsRef.current.connection.unsubscribe()
        }
        if (reconnectionWsRef.current.globalConnection && reconnectionWsRef.current.globalConnection.unsubscribe) {
          reconnectionWsRef.current.globalConnection.unsubscribe()
        }
        if (reconnectionWsRef.current.checkpointConnection && reconnectionWsRef.current.checkpointConnection.unsubscribe) {
          reconnectionWsRef.current.checkpointConnection.unsubscribe()
        }
        reconnectionWsRef.current = null
      }
    }
  }, [workflowState, currentBroadcast?.id]) // Removed unnecessary dependencies to prevent re-runs


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // DON'T automatically stop broadcast on unmount - let it persist for navigation
      // The global StreamingContext handles broadcast state persistence
      // Only cleanup component-specific WebSocket connections
      if (statusWsRef.current) {
        statusWsRef.current.close()
      }

      if (chatWsRef.current) {
        chatWsRef.current.disconnect()
      }

      if (songRequestWsRef.current) {
        songRequestWsRef.current.disconnect()
      }

      if (pollWsRef.current) {
        pollWsRef.current.disconnect()
      }
    }
  }, [])

  // Setup checkpoint polling fallback (every 60 seconds when broadcast is LIVE)
  useEffect(() => {
    if (!currentBroadcast?.id || currentBroadcast?.status !== 'LIVE') {
      return
    }

    logger.debug('DJ Dashboard: Setting up checkpoint polling fallback')

    const interval = setInterval(async () => {
      try {
        const healthResponse = await broadcastService.getLiveHealth()
        const health = healthResponse.data

        // Update duration from backend checkpoint if available
        if (health.currentDurationSeconds) {
          const durationMs = health.currentDurationSeconds * 1000
          const checkpointStart = new Date(Date.now() - durationMs)
          setBroadcastStartTime(checkpointStart)
        }

        // Update last checkpoint time if available
        if (health.lastCheckpointTime) {
          setLastCheckpointTime(new Date(health.lastCheckpointTime))
        }
      } catch (error) {
        logger.debug('DJ Dashboard: Failed to fetch checkpoint data (this is normal if WebSocket is working):', error)
      }
    }, 60000) // Every 60 seconds (matches backend checkpoint interval)

    return () => clearInterval(interval)
  }, [currentBroadcast?.id, currentBroadcast?.status])

  // Chat scrolling helpers (matching ListenerDashboard implementation)
  const isAtBottom = (container) => {
    if (!container) return true;
    const { scrollTop, scrollHeight, clientHeight } = container;
    return Math.abs(scrollHeight - clientHeight - scrollTop) < 10;
  };

  const scrollToBottom = () => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
      setShowScrollBottom(false);
    }
  };

  // Scroll detection: Show/hide scroll-to-bottom button
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setShowScrollBottom(!isAtBottom(container));
    };

    container.addEventListener('scroll', handleScroll);
    // Check initial state
    handleScroll();

    return () => container.removeEventListener('scroll', handleScroll);
  }, [chatMessages.length]); // Re-check when messages change

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [currentBroadcast?.id]); // Scroll when broadcast changes

  // Form handling functions
  const handleFormChange = (e) => {
    const { name, value } = e.target

    setBroadcastForm((prev) => ({
      ...prev,
      [name]: value,
    }))

    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: "",
      }))
    }
  }

  const validateForm = () => {
    const errors = {}

    if (!broadcastForm.title.trim()) {
      errors.title = "Title is required"
    }

    if (!broadcastForm.description.trim()) {
      errors.description = "Description is required"
    }

    // Validate scheduled fields if scheduling is enabled
    if (broadcastForm.isScheduled) {
      if (!broadcastForm.scheduledDate) {
        errors.scheduledDate = "Date is required for scheduled broadcasts"
      }
      if (!broadcastForm.scheduledStartTime) {
        errors.scheduledStartTime = "Start time is required"
      }
      if (!broadcastForm.scheduledEndTime) {
        errors.scheduledEndTime = "End time is required"
      }
      
      // Validate that scheduled date is not in the past
      if (broadcastForm.scheduledDate) {
        const [year, month, day] = broadcastForm.scheduledDate.split('-').map(Number)
        const scheduledDate = new Date(year, month - 1, day)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        scheduledDate.setHours(0, 0, 0, 0)
        
        if (scheduledDate < today) {
          errors.scheduledDate = "Cannot schedule broadcasts in the past"
        }
      }
      
      // Validate that scheduled start time is not in the past
      if (broadcastForm.scheduledDate && broadcastForm.scheduledStartTime) {
        const [year, month, day] = broadcastForm.scheduledDate.split('-').map(Number)
        const [startHour, startMinute] = broadcastForm.scheduledStartTime.split(':').map(Number)
        const scheduledStart = new Date(year, month - 1, day, startHour, startMinute, 0)
        const now = new Date()
        
        if (scheduledStart <= now) {
          errors.scheduledStartTime = "Start time cannot be in the past"
        }
      }
      
      // Validate that scheduled end time is not in the past and is after start time
      if (broadcastForm.scheduledDate && broadcastForm.scheduledEndTime) {
        const [year, month, day] = broadcastForm.scheduledDate.split('-').map(Number)
        const [endHour, endMinute] = broadcastForm.scheduledEndTime.split(':').map(Number)
        const scheduledEnd = new Date(year, month - 1, day, endHour, endMinute, 0)
        const now = new Date()
        
        if (scheduledEnd <= now) {
          errors.scheduledEndTime = "End time cannot be in the past"
        }
        
        // Validate that end time is after start time
        if (broadcastForm.scheduledStartTime) {
          const [startHour, startMinute] = broadcastForm.scheduledStartTime.split(':').map(Number)
          const scheduledStart = new Date(year, month - 1, day, startHour, startMinute, 0)
          
          if (scheduledEnd <= scheduledStart) {
            errors.scheduledEndTime = "End time must be after start time"
          }
        }
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Helper function to format local date/time as ISO string without timezone conversion
  const formatLocalTimeAsISO = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    const seconds = String(date.getSeconds()).padStart(2, "0")
    const milliseconds = String(date.getMilliseconds()).padStart(3, "0")

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`
  }

  const createBroadcast = async () => {
    if (!validateForm()) {
      return
    }

    // Double-check role permissions
    if (!currentUser || (currentUser.role !== 'DJ' && currentUser.role !== 'ADMIN')) {
      setStreamError("Access denied: You need DJ or Admin privileges to create broadcasts")
      return
    }

    setIsCreatingBroadcast(true)
    setStreamError(null)

    try {
      // Check for existing scheduled broadcast matching current time (if creating immediate broadcast)
      if (!broadcastForm.isScheduled) {
        try {
          const upcomingResponse = await broadcastService.getUpcoming()
          const upcomingBroadcasts = upcomingResponse.data || []
          
          // Check if there's a scheduled broadcast starting within the next 5 minutes
          const now = new Date()
          const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)
          
          const matchingBroadcast = upcomingBroadcasts.find(broadcast => {
            if (!broadcast.scheduledStart) return false
            const scheduledStart = new Date(broadcast.scheduledStart)
            // Check if scheduled start is between now and 5 minutes from now
            return scheduledStart >= now && scheduledStart <= fiveMinutesFromNow
          })
          
          if (matchingBroadcast) {
            logger.info("DJ Dashboard: Found scheduled broadcast matching current time, using it:", matchingBroadcast)
            setCurrentBroadcast(matchingBroadcast)
            setWorkflowState(WORKFLOW_STATES.READY_TO_STREAM)
            
            // Reset form
            setBroadcastForm({
              title: "",
              description: "",
              isScheduled: false,
              scheduledDate: "",
              scheduledStartTime: "",
              scheduledEndTime: "",
            })
            return
          }
        } catch (error) {
          logger.debug("Error checking for scheduled broadcasts:", error)
          // Continue with creating new broadcast if check fails
        }
      }

      // Prepare broadcast data
      const broadcastData = {
        title: broadcastForm.title.trim(),
        description: broadcastForm.description.trim(),
      }

      // Add scheduled times if scheduling is enabled
      if (broadcastForm.isScheduled && broadcastForm.scheduledDate && broadcastForm.scheduledStartTime && broadcastForm.scheduledEndTime) {
        const [year, month, day] = broadcastForm.scheduledDate.split('-').map(Number)
        const [startHour, startMinute] = broadcastForm.scheduledStartTime.split(':').map(Number)
        const [endHour, endMinute] = broadcastForm.scheduledEndTime.split(':').map(Number)

        const startDateTime = new Date(year, month - 1, day, startHour, startMinute, 0)
        const endDateTime = new Date(year, month - 1, day, endHour, endMinute, 0)
        const now = new Date()

        // Final validation: ensure times are not in the past
        if (startDateTime <= now) {
          setFormErrors({ scheduledStartTime: "Start time cannot be in the past" })
          setIsCreatingBroadcast(false)
          return
        }
        
        if (endDateTime <= now) {
          setFormErrors({ scheduledEndTime: "End time cannot be in the past" })
          setIsCreatingBroadcast(false)
          return
        }
        
        if (endDateTime <= startDateTime) {
          setFormErrors({ scheduledEndTime: "End time must be after start time" })
          setIsCreatingBroadcast(false)
          return
        }

        broadcastData.scheduledStart = formatLocalTimeAsISO(startDateTime)
        broadcastData.scheduledEnd = formatLocalTimeAsISO(endDateTime)
      }

      logger.debug("DJ Dashboard: Creating broadcast:", {
        title: broadcastData.title,
        description: broadcastData.description,
        isScheduled: broadcastForm.isScheduled,
        scheduledStart: broadcastData.scheduledStart,
      })

      const response = await broadcastService.create(broadcastData)
      const createdBroadcast = response.data

      setDraftBroadcast(createdBroadcast)
      setWorkflowState(WORKFLOW_STATES.READY_TO_STREAM)

      // Reset form
      setBroadcastForm({
        title: "",
        description: "",
        isScheduled: false,
        scheduledDate: "",
        scheduledStartTime: "",
        scheduledEndTime: "",
      })

      logger.debug("Broadcast created successfully:", createdBroadcast)
    } catch (error) {
      logger.error("Error creating broadcast:", error)
      setStreamError(error.response?.data?.message || "Failed to create broadcast")
    } finally {
      setIsCreatingBroadcast(false)
    }
  }

  // BUTT workflow: No browser-based broadcasting needed
  // DJs will start the radio server, then connect via BUTT directly to Icecast
  
  const startBroadcastLive = async () => {
    if (!currentBroadcast?.id) {
      setStreamError("No broadcast instance found")
      return
    }

    // Pre-validate state on frontend (optional, backend will also validate)
    if (currentBroadcast.status === 'LIVE') {
      setStreamError("Broadcast is already LIVE. Cannot start again.")
      return
    }

    if (currentBroadcast.status === 'ENDED') {
      setStreamError("Cannot start an ended broadcast. Please create a new broadcast.")
      return
    }

    try {
      setStreamError(null)
      logger.debug("Starting broadcast live:", currentBroadcast.id)

      // Call backend to start the broadcast (marks as LIVE, sets actualStart)
      const response = await broadcastService.start(currentBroadcast.id)
      const liveBroadcast = response.data

      // We don't need to set local state here; StreamingContext will update via WebSocket
      setWorkflowState(WORKFLOW_STATES.STREAMING_LIVE)

      // Apply a short grace period (15s) to suppress transient unhealthy/isLive=false UI for DJs
      try { setGraceUntilMs(Date.now() + 30000) } catch (_) {}

      if (liveBroadcast.actualStart) {
        try {
          setBroadcastStartTime(new Date(liveBroadcast.actualStart))
        } catch (_e) {
          setBroadcastStartTime(new Date())
        }
      } else {
        setBroadcastStartTime(new Date())
      }

      logger.debug("Broadcast is now live:", liveBroadcast)
    } catch (error) {
      logger.error("Error starting broadcast:", error)

      // Handle circuit breaker errors
      if (error.message?.includes('temporarily unavailable')) {
        const retryMatch = error.message.match(/(\d+) seconds/);
        const retrySeconds = retryMatch ? parseInt(retryMatch[1], 10) : 60;

        setStreamError(`Service temporarily unavailable. Retrying in ${retrySeconds} seconds...`);

        // Auto-retry after delay
        setTimeout(() => {
          startBroadcastLive();
        }, retrySeconds * 1000);
        return;
      }

      // Handle state machine validation errors
      const stateMachineError = handleStateMachineError(error);
      if (stateMachineError) {
        setStreamError(`Cannot start broadcast: ${stateMachineError.message}`);
        // Refresh broadcast state
        try {
          const updated = await broadcastService.getById(currentBroadcast.id);
          setCurrentBroadcast(updated.data);
        } catch (refreshError) {
          logger.error("Failed to refresh broadcast state:", refreshError);
        }
        return;
      }

      // Handle other errors with enhanced error messages
      const broadcastError = getBroadcastErrorMessage(error);
      setStreamError(`Error starting broadcast: ${broadcastError.userMessage}`);
    }
  }

  const stopBroadcast = async () => {
    if (isStoppingBroadcast) {
      logger.debug("Broadcast stop already in progress, ignoring duplicate call")
      return
    }

    if (!currentBroadcast?.id) {
      setStreamError("No broadcast instance found")
      return
    }

    // Pre-validate state on frontend (optional, backend will also validate)
    if (currentBroadcast.status !== 'LIVE') {
      setStreamError("Broadcast is not currently LIVE. Cannot end a broadcast that is not live.")
      return
    }

    try {
      setIsStoppingBroadcast(true)
      setStreamError(null)
      logger.debug("Ending broadcast via API:", currentBroadcast.id)

      // Mark the broadcast as ended on the backend (records actualEnd, analytics/history)
      await broadcastService.end(currentBroadcast.id)

      // Also stop the Liquidsoap radio server via the radio agent (idempotent)
      try {
        logger.debug("Stopping radio server via agent after ending broadcast")
        await radioService.stop()
        setRadioServerState('stopped')
      } catch (stopErr) {
        // Non-blocking: log error but continue cleanup
        logger.error("Failed to stop radio server after ending broadcast:", stopErr)
        setRadioServerError(stopErr?.response?.data?.detail || stopErr?.message || 'Failed to stop radio server')
      } finally {
        // Refresh status to confirm
        try { await fetchRadioStatus() } catch (_) {}
      }

      // Reset local broadcast state
      setDraftBroadcast(null)
      setWorkflowState(WORKFLOW_STATES.CREATE_BROADCAST)

      // Reset analytics and UI state
      setBroadcastStartTime(null)
      setTotalInteractions(0)
      setPeakListeners(0)
      setTotalSongRequests(0)
      setTotalPolls(0)
      setChatMessages([])
      setSongRequests([])
      setPolls([])
      setActivePoll(null)
    } catch (error) {
      logger.error("Error ending broadcast:", error)

      // Handle circuit breaker errors
      if (error.message?.includes('temporarily unavailable')) {
        const retryMatch = error.message.match(/(\d+) seconds/);
        const retrySeconds = retryMatch ? parseInt(retryMatch[1], 10) : 60;

        setStreamError(`Service temporarily unavailable. Cannot end broadcast right now. Please try again in ${retrySeconds} seconds.`);
        return;
      }

      // Handle state machine validation errors
      const stateMachineError = handleStateMachineError(error);
      if (stateMachineError) {
        setStreamError(`Cannot end broadcast: ${stateMachineError.message}`);
        // Refresh broadcast state
        try {
          const updated = await broadcastService.getById(currentBroadcast.id);
          setCurrentBroadcast(updated.data);
        } catch (refreshError) {
          logger.error("Failed to refresh broadcast state:", refreshError);
        }
        return;
      }

      // Handle other errors with enhanced error messages
      const broadcastError = getBroadcastErrorMessage(error);
      setStreamError(`Error ending broadcast: ${broadcastError.userMessage}`);
    } finally {
      setIsStoppingBroadcast(false)
    }
  }

  // Confirmation handler that triggers stop flow
  const confirmStopBroadcast = async () => {
    try {
      setConfirmEndOpen(false)
      await stopBroadcast()
    } catch (_) { /* handled in stopBroadcast */ }
  }

  const cancelBroadcast = async () => {
    if (!currentBroadcast) {
      setStreamError("No broadcast instance found")
      return
    }

    try {
      setStreamError(null)
      logger.debug("Canceling broadcast:", currentBroadcast.id)

      // Delete the broadcast from the backend
      await broadcastService.delete(currentBroadcast.id)

      // Reset state back to create new broadcast
      setDraftBroadcast(null)
      setWorkflowState(WORKFLOW_STATES.CREATE_BROADCAST)
    } catch (error) {
      logger.error("Error canceling broadcast:", error)
      setStreamError(`Error canceling broadcast: ${error.message}`)
    }
  }

  // Audio restoration not needed for BUTT workflow

  // Slow mode save handler
  const handleSaveSlowMode = async () => {
    if (!currentBroadcast?.id) return
    try {
      setIsSavingSlowMode(true)
      const seconds = Math.max(0, Math.min(3600, parseInt(slowModeSeconds, 10) || 0))
      const response = await broadcastService.updateSlowMode(currentBroadcast.id, {
        enabled: !!slowModeEnabled,
        seconds
      })
      const updated = response?.data || null
      if (updated) {
        setCurrentBroadcast(updated)
      }
    } catch (error) {
      logger.error('Error updating slow mode:', error)
      showToast('Failed to update slow mode. Please try again.', 'error')
    } finally {
      setIsSavingSlowMode(false)
    }
  }

  // Interaction Panel Handlers
  const handleBanUser = async (userId, displayName) => {
    try {
      if (!userId) return;
      // Only allow DJs and Admins to ban from the DJ dashboard
      if (!currentUser || (currentUser.role !== 'DJ' && currentUser.role !== 'ADMIN')) {
        showToast('You do not have permission to ban users.', 'error');
        return;
      }
      const confirmed = window.confirm(`Ban ${displayName || 'this user'} from chat permanently?`);
      if (!confirmed) return;
      await authService.banUser(userId, { unit: 'PERMANENT', reason: `Banned by ${currentUser.firstname || ''} ${currentUser.lastname || ''}`.trim() });
      showToast(`${displayName || 'User'} has been banned.`, 'success');
    } catch (error) {
      logger.error('Failed to ban user from chat:', error);
      const msg = (error && (error.response?.data?.message || error.message)) || 'Unknown error';
      showToast(`Failed to ban user: ${msg}`, 'error');
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault()

    if (!chatMessage.trim() || !currentBroadcast) return

    const messageText = chatMessage.trim()

    try {
      if (messageText.length > 1500) {
        showToast("Message cannot exceed 1500 characters", 'warning')
        return
      }
      // Always send via REST (WS is receive-only). Use the WS wrapper if present (it now calls REST).
      const send = (chatWsRef.current && chatWsRef.current.sendMessage)
        ? () => chatWsRef.current.sendMessage(messageText)
        : () => chatService.sendMessage(currentBroadcast.id, { content: messageText })

      await send()
      setChatMessage("")
      
      // Always auto-scroll to bottom after sending message (wait for message to appear in UI via WebSocket)
      // The WebSocket handler will also scroll, but we ensure it happens here too
      setTimeout(() => {
        scrollToBottom();
        setShowScrollBottom(false);
      }, 300)
    } catch (error) {
      logger.error("Error sending chat message:", error)
      const status = error?.response?.status
      if (status === 401) {
        showToast("Your session expired. Please log in again.", 'error')
      } else if (status === 429) {
        const headers = error.response?.headers || {}
        const retryAfter = headers['retry-after'] || headers['Retry-After'] || headers['Retry-after']
        const sec = parseInt(retryAfter, 10)
        const waitMsg = Number.isFinite(sec) ? `${sec} second${sec === 1 ? '' : 's'}` : 'a few seconds'
        showToast(`Slow mode is enabled. Please wait ${waitMsg} before sending another message.`, 'warning')
      } else if (error.response?.data?.message?.includes("1500 characters")) {
        showToast("Message cannot exceed 1500 characters", 'warning')
      } else {
        showToast("Failed to send message. Please try again.", 'error')
      }
      // Restore message if sending failed
      setChatMessage(messageText)
    }
  }

  const handleDownloadChat = async () => {
    if (!currentBroadcast?.id) return
    try {
      setIsDownloadingChat(true)
      const response = await broadcastService.exportChat(currentBroadcast.id)
      const blob = new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      // Use server-provided filename from Content-Disposition
      try {
        const cd = response.headers && (response.headers['content-disposition'] || response.headers['Content-Disposition'])
        if (cd) {
          const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd)
          const encoded = match && (match[1] || match[2])
          if (encoded) link.download = decodeURIComponent(encoded)
        }
      } catch {}
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      logger.error("Error downloading chat messages:", error)
      showToast("Failed to download chat messages. Please try again.", 'error')
    } finally {
      setIsDownloadingChat(false)
    }
  }

  const handleDeleteSongRequest = async (requestId) => {
    if (!currentBroadcast) return

    try {
      logger.debug("Deleting song request:", requestId)
      await songRequestService.deleteRequest(currentBroadcast.id, requestId)

      // Remove the deleted request from the state
      setSongRequests((prev) => prev.filter((request) => request.id !== requestId))

      logger.debug("Song request deleted successfully")
    } catch (error) {
      logger.error("Error deleting song request:", error)
      showToast("Failed to delete song request. Please try again.", 'error')
    }
  }

  const handlePollSubmit = async (e) => {
    e.preventDefault()

    if (!newPoll.question.trim() || !currentBroadcast) return

    const validOptions = newPoll.options.filter((option) => option.trim())

    if (validOptions.length < 2) {
      return
    }

    try {
      setIsCreatingPoll(true)

      const pollData = {
        question: newPoll.question.trim(),
        broadcastId: currentBroadcast.id,
        options: validOptions,
      }

      const response = await pollService.createPoll(pollData)
      const createdPoll = response.data

      logger.debug("DJ Dashboard: Poll created successfully (draft):", createdPoll)

      // Add draft poll to local state (not active yet)
      setPolls((prev) => {
        const exists = prev.some((poll) => poll.id === createdPoll.id)
        if (exists) return prev
        return [createdPoll, ...prev]
      })

      // Track poll creation
      setTotalPolls((prev) => prev + 1)

      // Reset form and close creation panel
      setNewPoll({ question: "", options: ["", ""] })
      setShowPollCreation(false)
    } catch (error) {
      logger.error("Error creating poll:", error)
    } finally {
      setIsCreatingPoll(false)
    }
  }

  // --- Poll Controls ---
  const handlePostPoll = async (pollId) => {
    try {
      // Fetch latest results before reposting to preserve votes
      const resultsResponse = await pollService.getPollResults(pollId)
      const latestResults = resultsResponse.data
      
      const response = await pollService.showPoll(pollId)
      const posted = response.data
      
      // Merge latest results into posted poll data
      const postedWithResults = {
        ...posted,
        options: latestResults.options || posted.options,
        totalVotes: latestResults.totalVotes || 0
      }
      
      logger.debug("DJ Dashboard: Poll posted/reposted:", postedWithResults)
      setPolls((prev) => prev.map((p) => (p.id === postedWithResults.id ? postedWithResults : p)))
      setActivePoll(postedWithResults)
    } catch (error) {
      logger.error("DJ Dashboard: Failed to post poll:", error)
    }
  }

  const handleEndPoll = async (pollId) => {
    try {
      // Fetch latest results before ending to preserve them
      const resultsResponse = await pollService.getPollResults(pollId)
      const latestResults = resultsResponse.data
      
      const response = await pollService.endPoll(pollId)
      const ended = response.data
      
      // Merge latest results into ended poll data
      const endedWithResults = {
        ...ended,
        options: latestResults.options || ended.options,
        totalVotes: latestResults.totalVotes || 0
      }
      
      logger.debug("DJ Dashboard: Poll ended (results preserved):", endedWithResults)
      setPolls((prev) => prev.map((p) => (p.id === endedWithResults.id ? endedWithResults : p)))
      // Don't clear activePoll - keep showing results even when ended
    } catch (error) {
      logger.error("DJ Dashboard: Failed to end poll:", error)
    }
  }

  // Legacy handler - keeping for compatibility but redirects to handleEndPoll
  const handleStopPoll = handleEndPoll

  const handleDeletePoll = async (pollId) => {
    try {
      await pollService.deletePoll(pollId)
      logger.debug("DJ Dashboard: Poll deleted:", pollId)
      setPolls((prev) => prev.filter((p) => p.id !== pollId))
      setActivePoll((prev) => (prev && prev.id === pollId ? null : prev))
      setTotalPolls((prev) => (prev > 0 ? prev - 1 : 0))
    } catch (error) {
      logger.error("DJ Dashboard: Failed to delete poll:", error)
    }
  }

  const addPollOption = () => {
    if (newPoll.options.length < 5) {
      setNewPoll((prev) => ({
        ...prev,
        options: [...prev.options, ""],
      }))
    }
  }

  const removePollOption = (index) => {
    if (newPoll.options.length > 2) {
      setNewPoll((prev) => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index),
      }))
    }
  }

  const updatePollOption = (index, value) => {
    setNewPoll((prev) => ({
      ...prev,
      options: prev.options.map((option, i) => (i === index ? value : option)),
    }))
  }

  // Helper function to get broadcast duration
  const getBroadcastDuration = () => {
    if (!broadcastStartTime) return "00:00:00"

    const now = new Date()
    const diff = now - broadcastStartTime

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  // Check if another DJ is broadcasting and show read-only view
  const isActiveDJ = currentBroadcast?.status === 'LIVE' && 
                     (currentBroadcast?.currentActiveDJ?.id === currentUser?.id || 
                      currentBroadcast?.startedBy?.id === currentUser?.id || 
                      currentBroadcast?.createdBy?.id === currentUser?.id);

  if (currentBroadcast?.status === 'LIVE' && !isActiveDJ && 
      (currentUser.role === 'DJ' || currentUser.role === 'MODERATOR' || currentUser.role === 'ADMIN')) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-6">
        <div className="container mx-auto px-4">
          <ReadOnlyView 
            message="Another DJ is currently broadcasting"
            activeDJ={currentBroadcast.currentActiveDJ || currentBroadcast.startedBy}
          />
        </div>
      </div>
    );
  }

  return (
      <div className="relative min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Success Notification Banner */}
        <SuccessNotification
          message={successNotificationMessage}
          isVisible={showSuccessNotification}
          onClose={() => setShowSuccessNotification(false)}
        />
        
        {toastState.show && (
          <Toast
            message={toastState.message}
            type={toastState.type}
            onClose={() => setToastState(prev => ({ ...prev, show: false }))}
          />
        )}

        <div className="container mx-auto px-4 pt-0 pb-4">
          {/* End Broadcast Confirmation Modal */}
          {confirmEndOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-5">
                <div className="flex items-start space-x-3">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">End broadcast?</h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      This will end the current broadcast and stop the radio server. Are you sure you want to continue?
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => setConfirmEndOpen(false)}
                    className="px-4 py-2 text-sm rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmStopBroadcast}
                    className="px-4 py-2 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white"
                  >
                    End Broadcast
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DJ Handover Modal */}
          {currentBroadcast && (
            <DJHandoverModal
              isOpen={showHandoverModal}
              onClose={() => setShowHandoverModal(false)}
              broadcastId={currentBroadcast.id}
              currentDJ={currentBroadcast.currentActiveDJ}
              loggedInUser={currentUser}
              onHandoverSuccess={async (handoverData) => {
                // After account switch handover, update auth context and refresh data
                try {
                  // The handoverLogin already updated AuthContext, but refresh to ensure sync
                  await checkAuthStatus();
                  
                  // Refresh broadcast data
                  // We fetch it to ensure local cache is hot, but Context update happens via WebSocket
                  await broadcastService.getById(currentBroadcast.id);
                  
                  // Show success notification
                  const djName = handoverData?.user?.name ||
                    (handoverData?.user?.firstname && handoverData?.user?.lastname
                      ? `${handoverData.user.firstname} ${handoverData.user.lastname}`
                      : handoverData?.user?.email || 'Unknown DJ');
                  setSuccessNotificationMessage(`✓ Successfully switched to ${djName}`);
                  setShowSuccessNotification(true);
                  
                  logger.info('Handover completed successfully. Account switched to:', handoverData?.user?.email);
                } catch (error) {
                  logger.error('Error refreshing after handover:', error);
                }
              }}
            />
          )}
          {/* Live Streaming Status Bar - Fixed at top when live */}
          {workflowState === WORKFLOW_STATES.STREAMING_LIVE && currentBroadcast && (
              <div className="bg-red-600 text-white rounded-lg shadow-lg mb-6 sticky top-4 z-50">
                <div className="px-4 py-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center bg-white bg-opacity-20 rounded-full px-3 py-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse mr-2"></span>
                        <span className="font-bold text-sm">LIVE</span>
                      </div>
                      <div className="truncate">
                        <h2 className="text-lg font-bold truncate">{currentBroadcast.title}</h2>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs opacity-90">
                          <div className="flex items-center">
                            <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
                              radioServerState === 'running' ? 'bg-green-300' :
                              radioServerState === 'unknown' ? 'bg-yellow-300' : 'bg-red-300'
                            }`}></span>
                            <span>Server: {
                              radioServerState === 'running' ? 'Running' :
                              radioServerState === 'unknown' ? 'Checking...' : 'Offline'
                            }</span>
                          </div>
                          <div className="flex items-center">
                            <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${websocketConnected ? "bg-green-300" : "bg-yellow-300"}`}></span>
                            <span>{(graceUntilMs && Date.now() < graceUntilMs) ? "Connecting…" : (websocketConnected ? "Connected" : "Disconnected")}</span>
                          </div>
                          {streamStatusCircuitBreakerOpen && (
                            <div className="flex items-center">
                              <span className="h-1.5 w-1.5 rounded-full mr-1.5 bg-orange-400"></span>
                              <span>Status: Degraded</span>
                            </div>
                          )}
                          <div className="flex items-center">
                            <span className="font-semibold mr-1">{listenerCount}</span>
                            <span>listener{listenerCount !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Slow Mode Controls */}
                      {currentBroadcast && (
                        <div className="flex items-center bg-white bg-opacity-10 rounded-md px-2 py-1 mr-2 text-xs">
                          <label className="flex items-center mr-2">
                            <input
                              type="checkbox"
                              className="mr-1"
                              checked={slowModeEnabled}
                              onChange={(e) => setSlowModeEnabled(e.target.checked)}
                            />
                            <span>Slow mode</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={3600}
                            value={slowModeSeconds}
                            onChange={(e) => setSlowModeSeconds(e.target.value)}
                            className="w-20 px-2 py-1 rounded bg-white bg-opacity-20 border border-white/30 text-white placeholder-white/70 focus:outline-none"
                            placeholder="secs"
                            title="Seconds between messages"
                          />
                          <button
                            onClick={handleSaveSlowMode}
                            disabled={isSavingSlowMode}
                            className="ml-2 px-2 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded transition-all duration-200 disabled:opacity-50"
                            title="Save slow mode settings"
                          >
                            {isSavingSlowMode ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      )}
                      {/* Handover Button - Show for any DJ on live broadcasts, or Admin/Moderator */}
                      {currentBroadcast?.status === 'LIVE' &&
                       (currentUser?.role === 'ADMIN' || currentUser?.role === 'MODERATOR' ||
                        currentUser?.role === 'DJ') && (
                        <button
                          onClick={() => setShowHandoverModal(true)}
                          className="flex items-center px-4 py-1.5 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-md transition-all duration-200 text-sm font-medium"
                          title="Handover broadcast to another DJ"
                        >
                          <UserIcon className="h-3.5 w-3.5 mr-1.5" />
                          Handover
                        </button>
                      )}
                      <button
                          onClick={() => setConfirmEndOpen(true)}
                          disabled={isStoppingBroadcast || currentBroadcast?.status !== 'LIVE'}
                          className="flex items-center px-4 py-1.5 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-md transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          title={currentBroadcast?.status !== 'LIVE' ? 'Broadcast is not currently live' : 'End the current broadcast'}
                      >
                        <StopIcon className="h-3.5 w-3.5 mr-1.5" />
                        {isStoppingBroadcast ? "Ending..." : currentBroadcast?.status !== 'LIVE' ? "Not Live" : "End Broadcast"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
          )}

          {/* Recovery Notification */}
          {isRecoveringBroadcast && (
              <div className="mb-6 p-4 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 rounded-md border border-green-300 dark:border-green-800 animate-pulse">
                <div className="flex items-start space-x-3">
                  <CheckIcon className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">🔴 Live Broadcast Recovered</h3>
                    <p className="text-sm">Your live broadcast has been restored. You can continue streaming!</p>
                  </div>
                </div>
              </div>
          )}


          {/* Error Display */}
          {streamError && (
              <div className="mb-6 p-4 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200 rounded-md border border-red-300 dark:border-red-800">
                <div className="flex items-start space-x-3">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">Broadcast Error</h3>
                    <div className="text-sm whitespace-pre-line">{streamError}</div>
                  </div>
                </div>
              </div>
          )}

          {/* BUTT workflow: Audio is managed via BUTT, not browser */}

          {/* Workflow Progress Indicator - Hidden when live, more prominent */}
          {workflowState !== WORKFLOW_STATES.STREAMING_LIVE && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-6 border-2 border-gray-200 dark:border-gray-700">
                <div className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">Broadcast Workflow</h2>
                  <div className="flex items-center justify-between max-w-3xl mx-auto">
                    {/* Step 1: Create Broadcast Content */}
                    <div className="flex flex-col items-center flex-1">
                      <div
                          className={`flex items-center justify-center w-12 h-12 rounded-full border-4 mb-3 ${
                              workflowState === WORKFLOW_STATES.CREATE_BROADCAST
                                  ? "border-maroon-600 bg-maroon-600 text-white shadow-lg scale-110"
                                  : workflowState === WORKFLOW_STATES.READY_TO_STREAM ||
                                  workflowState === WORKFLOW_STATES.STREAMING_LIVE
                                      ? "border-green-500 bg-green-500 text-white shadow-md"
                                      : "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-400"
                          }`}
                      >
                        <span className="text-lg font-bold">
                        {workflowState === WORKFLOW_STATES.CREATE_BROADCAST ? (
                              "1"
                        ) : (
                              <CheckIcon className="h-6 w-6" />
                        )}
                        </span>
                      </div>
                      <span className={`text-sm font-semibold text-center ${workflowState === WORKFLOW_STATES.CREATE_BROADCAST ? "text-maroon-700 dark:text-maroon-400" : "text-gray-900 dark:text-white"}`}>
                        Create Broadcast
                      </span>
                    </div>
                    {/* Arrow */}
                    <div className={`flex-1 h-1 mx-4 ${workflowState === WORKFLOW_STATES.READY_TO_STREAM || workflowState === WORKFLOW_STATES.STREAMING_LIVE ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}></div>
                    {/* Step 2: Ready to Stream */}
                    <div className="flex flex-col items-center flex-1">
                      <div
                          className={`flex items-center justify-center w-12 h-12 rounded-full border-4 mb-3 ${
                              workflowState === WORKFLOW_STATES.READY_TO_STREAM
                                  ? "border-maroon-600 bg-maroon-600 text-white shadow-lg scale-110"
                                  : workflowState === WORKFLOW_STATES.STREAMING_LIVE
                                      ? "border-green-500 bg-green-500 text-white shadow-md"
                                      : "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-400"
                          }`}
                      >
                        <span className="text-lg font-bold">
                          {workflowState === WORKFLOW_STATES.READY_TO_STREAM ? (
                              "2"
                          ) : workflowState === WORKFLOW_STATES.STREAMING_LIVE ? (
                              <CheckIcon className="h-6 w-6" />
                        ) : (
                              "2"
                        )}
                        </span>
                      </div>
                      <span className={`text-sm font-semibold text-center ${workflowState === WORKFLOW_STATES.READY_TO_STREAM ? "text-maroon-700 dark:text-maroon-400" : "text-gray-900 dark:text-white"}`}>
                        Ready to Stream
                      </span>
                    </div>
                    {/* Arrow */}
                    <div className={`flex-1 h-1 mx-4 ${workflowState === WORKFLOW_STATES.STREAMING_LIVE ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}></div>
                    {/* Step 3: Live Streaming */}
                    <div className="flex flex-col items-center flex-1">
                      <div
                          className={`flex items-center justify-center w-12 h-12 rounded-full border-4 mb-3 ${
                              workflowState === WORKFLOW_STATES.STREAMING_LIVE
                                  ? "border-red-600 bg-red-600 text-white shadow-lg scale-110 animate-pulse"
                                  : "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-400"
                          }`}
                      >
                        <MicrophoneIcon className="h-6 w-6" />
                      </div>
                      <span className={`text-sm font-semibold text-center ${workflowState === WORKFLOW_STATES.STREAMING_LIVE ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
                        Live Streaming
                      </span>
                    </div>
                  </div>
                </div>
              </div>
          )}

          {/* Live Interactive Dashboard - When streaming live */}
          {workflowState === WORKFLOW_STATES.STREAMING_LIVE && currentBroadcast && (
                <>
                {/* Dropdown Portal - Rendered outside container to avoid clipping */}
                {showSettingsDropdown && (
                  <div 
                    data-settings-dropdown
                    className="fixed bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-[9999] p-4 w-96 max-w-[calc(100vw-3rem)] max-h-[80vh] overflow-y-auto"
                    style={{
                      top: `${dropdownPosition.top}px`,
                      right: `${dropdownPosition.right}px`
                    }}
                  >
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                      <h4 className="font-bold text-gray-900 dark:text-white">Profanity Dictionary</h4>
                      <button
                        onClick={() => setShowSettingsDropdown(false)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                    <ProfanityManager />
                  </div>
                )}

                {/* Analytics Dashboard - Key Metrics */}
                <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Duration</span>
                        <ClockIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="text-lg font-bold text-emerald-800 dark:text-emerald-200">{getBroadcastDuration()}</div>
                      {lastCheckpointTime && (
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                          Last saved: {formatDistanceToNow(lastCheckpointTime, { addSuffix: true })}
                        </div>
                      )}
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Listeners</span>
                        <UserIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="text-lg font-bold text-blue-800 dark:text-blue-200">{listenerCount}</div>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-orange-700 dark:text-orange-300">Peak</span>
                        <svg className="h-4 w-4 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 2L13.09 8.26L20 9.27L15 14.14L16.18 21.02L10 17.77L3.82 21.02L5 14.14L0 9.27L6.91 8.26L10 2Z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-lg font-bold text-orange-800 dark:text-orange-200">{peakListeners}</div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Messages</span>
                        <ChatBubbleLeftRightIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="text-lg font-bold text-purple-800 dark:text-purple-200">{chatMessages.length}</div>
                    </div>
                    <div className="bg-gold-50 dark:bg-gold-900/20 rounded-lg p-3 border border-gold-200 dark:border-gold-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-maroon-700 dark:text-gold-300">Requests</span>
                        <MusicalNoteIcon className="h-4 w-4 text-gold-600 dark:text-gold-400" />
                      </div>
                      <div className="text-lg font-bold text-maroon-800 dark:text-gold-200">{totalSongRequests}</div>
                    </div>
                    <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3 border border-teal-200 dark:border-teal-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-teal-700 dark:text-teal-300">Polls</span>
                        <ChartBarIcon className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div className="text-lg font-bold text-teal-800 dark:text-teal-200">{totalPolls}</div>
                    </div>
                    <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-3 border border-rose-200 dark:border-rose-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-rose-700 dark:text-rose-300">Interactions</span>
                        <HeartIcon className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                      </div>
                      <div className="text-lg font-bold text-rose-800 dark:text-rose-200">{totalInteractions}</div>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 border border-indigo-200 dark:border-indigo-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Engagement</span>
                        <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-lg font-bold text-indigo-800 dark:text-indigo-200">
                        {listenerCount > 0 ? Math.round((totalInteractions / listenerCount) * 100) : 0}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Content Area - Three Column Layout */}
                {/* Cards are responsive: max 777px, adapt to viewport height accounting for sticky header, min 400px */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
                  {/* Left Column: Song Requests */}
                  <div className="lg:col-span-3">
                    {/* Song Requests Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col transition-all duration-300 ease-in-out" style={{ 
                      height: 'min(777px, calc(100vh - 16rem))', 
                      maxHeight: '777px', 
                      minHeight: 'clamp(400px, 50vh, 777px)' 
                    }}>
                      <div className="bg-gold-500 text-maroon-900 px-4 py-3 border-b border-gold-400 flex-shrink-0">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MusicalNoteIcon className="h-5 w-5" />
                            <h3 className="font-bold text-base">Song Requests</h3>
                        </div>
                          <span className="text-sm bg-maroon-900/30 px-2.5 py-1 rounded-full font-bold min-w-[2rem] text-center">
                            {songRequests.length}
                          </span>
                        </div>
                      </div>
                      <EnhancedScrollArea className="flex-1 min-h-0 flex-shrink-0">
                        <div className="p-3 space-y-2.5">
                          {songRequests.length === 0 ? (
                            <div className="text-center text-gray-500 dark:text-gray-400 py-12 px-4">
                              <MusicalNoteIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                              <p className="text-sm">No song requests yet</p>
                            </div>
                          ) : (
                            songRequests.map((request) => (
                                <div key={request.id} className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow">
                                  <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-0.5">
                                      <div className="w-8 h-8 bg-gold-500 rounded-lg flex items-center justify-center shadow-sm">
                                        <MusicalNoteIcon className="w-4 h-4 text-white" />
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-start gap-2">
                                        <div>
                                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                                            {request.songTitle}
                                          </h4>
                                          {request.artist && (
                                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">by {request.artist}</p>
                                          )}
                                          {request.requestedBy && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                                              <span> • </span>
                                              <span>
                                                {(() => {
                                                  try {
                                                    const f = request.requestedBy?.firstname || '';
                                                    const l = request.requestedBy?.lastname || '';
                                                    const full = `${f} ${l}`.trim();
                                                    return full || request.requestedBy?.email || 'Anonymous';
                                                  } catch (_) {
                                                    return 'Anonymous';
                                                  }
                                                })()}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteSongRequest(request.id)}
                                            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                            title="Remove request"
                                            aria-label="Remove song request"
                                        >
                                          <XMarkIcon className="h-4 w-4" />
                                        </button>
                                      </div>
                                      {request.dedication && (
                                          <p className="text-xs text-gray-600 dark:text-gray-400 italic mt-2 pl-2 border-l-2 border-gold-400">
                                            "{request.dedication}"
                                          </p>
                                      )}
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                        {(() => {
                                          try {
                                            const ms = request?._sentAt ?? getSongRequestTimeMs(request, false)
                                            if (typeof ms === 'number') {
                                              const diffMs = Date.now() - ms
                                              if (diffMs < 60 * 1000) return 'just now'
                                              return formatDistanceToNow(new Date(ms), { addSuffix: true })
                                            }
                                            return 'just now'
                                          } catch (error) {
                                            return 'just now'
                                          }
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                            ))
                          )}
                        </div>
                      </EnhancedScrollArea>
                    </div>
                  </div>

                  {/* Center Column: Live Chat - Main Focus */}
                  <div className="lg:col-span-6 w-full">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col transition-all duration-300 ease-in-out" style={{ 
                      height: 'min(777px, calc(100vh - 16rem))', 
                      maxHeight: '777px', 
                      minHeight: 'clamp(400px, 50vh, 777px)' 
                    }}>
                      {/* Header */}
                      <div className="bg-maroon-600 text-white px-3 sm:px-5 py-3 sm:py-4 border-b border-maroon-700 flex-shrink-0">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <ChatBubbleLeftRightIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                            <h3 className="font-bold text-base sm:text-lg">Live Chat</h3>
                          </div>
                          <div className="flex items-center space-x-2 sm:space-x-3 flex-wrap">
                            <span className="text-xs sm:text-sm bg-white bg-opacity-20 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-bold">
                              {chatMessages.length} {chatMessages.length === 1 ? 'message' : 'messages'}
                          </span>
                          <button
                            onClick={handleDownloadChat}
                            disabled={isDownloadingChat || !currentBroadcast?.id}
                              className="inline-flex items-center text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                            title="Download chat messages as Excel (available for 7 days)"
                          >
                              <ArrowDownTrayIcon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5 ${isDownloadingChat ? "animate-pulse" : ""}`} />
                              <span className="hidden sm:inline">{isDownloadingChat ? "Downloading..." : "Download"}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                      {/* Messages Area - Flex to fill remaining space in 777px card */}
                      <div className="flex-1 overflow-hidden flex-shrink-0 min-h-0 relative">
                        <div className="h-full overflow-y-auto p-3 sm:p-4 space-y-3 custom-scrollbar chat-messages-container" ref={chatContainerRef}>
                        {chatMessages.length === 0 ? (
                            <div className="text-center text-gray-500 dark:text-gray-400 py-8 sm:py-12">
                              <ChatBubbleLeftRightIcon className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 opacity-30" />
                              <p className="text-sm sm:text-base">No messages yet</p>
                              <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1">Start the conversation!</p>
                            </div>
                        ) : (
                            chatMessages
                                .slice()
                                .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                                .map((msg) => {
                                  if (!msg || !msg.sender) return null

                                  const firstName = msg.sender?.firstname || ""
                                  const lastName = msg.sender?.lastname || ""
                                  const fullName = `${firstName} ${lastName}`.trim()
                                  const senderName = fullName || msg.sender?.email || "Unknown User"

                                  const isDJ =
                                      (msg.sender?.role && msg.sender.role.includes("DJ")) ||
                                      senderName.includes("DJ") ||
                                      firstName.includes("DJ") ||
                                      lastName.includes("DJ")

                                  const initials = (() => {
                                    try {
                                      return (
                                          senderName
                                              .split(" ")
                                              .map((part) => part[0] || "")
                                              .join("")
                                              .toUpperCase()
                                              .slice(0, 2) || "U"
                                      )
                                    } catch (error) {
                                      return "U"
                                    }
                                  })()

                                // Handle date parsing more robustly (same as ListenerDashboard)
                                  let messageDate;
                                  try {
                                  const ts = msg.createdAt || msg.timestamp || msg.sentAt || msg.time || msg.date;
                                  messageDate = ts ? new Date(ts) : null;
                                  } catch (error) {
                                  logger.error('Error parsing message date:', error);
                                    messageDate = new Date();
                                  }

                                const formattedTime = (() => {
                                    try {
                                      return messageDate && !isNaN(messageDate.getTime())
                                        ? format(messageDate, 'hh:mm a')
                                        : ""
                                    } catch (error) {
                                    return ""
                                    }
                                  })()

                                  return (
                                  <div key={msg.id} className="flex items-start space-x-2 sm:space-x-3">
                                        <div
                                      className={`flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm text-white font-bold ${
                                                isDJ ? "bg-maroon-600" : "bg-gray-500"
                                            }`}
                                        >
                                          {isDJ ? "DJ" : initials}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                      <div className="flex items-center flex-wrap gap-1 sm:gap-2 mb-1">
                                        <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                                    {senderName}
                                  </span>
                                        {formattedTime && (
                                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                            {formattedTime}
                                          </span>
                                        )}
                                                                                        {(currentUser?.role === 'DJ' || currentUser?.role === 'ADMIN') && msg.sender?.id !== currentUser?.id && msg.sender?.role !== 'ADMIN' && (
                                                                                          <button
                                                                                            type="button"
                                                                                            onClick={() => handleBanUser(msg.sender.id, senderName)}
                                            className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 flex-shrink-0"
                                                                                            title="Ban this user from chat"
                                                                                          >
                                                                                            Ban
                                                                                          </button>
                                                                                        )}
                                          </div>
                                      <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 break-words">
                                            {msg.content || "No content"}
                                          </p>
                                        </div>
                                      </div>
                                  )
                                })
                                .filter(Boolean)
                        )}
                      </div>
                        
                        {/* Scroll to bottom button - Minimalist design */}
                        {showScrollBottom && (
                          <div className="absolute bottom-4 right-4 z-10">
                            <button
                              onClick={scrollToBottom}
                              className="bg-maroon-600 hover:bg-maroon-700 text-white rounded-full w-10 h-10 shadow-lg hover:shadow-xl transition-all duration-200 ease-in-out flex items-center justify-center hover:scale-110 border border-maroon-500"
                              aria-label="Scroll to bottom"
                              title="Scroll to latest messages"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Input Area - Outside messages container, at bottom of card */}
                      <div className="border-t border-gray-200 dark:border-gray-700 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
                        <form onSubmit={handleChatSubmit} className="flex space-x-2 sm:space-x-3">
                          <input
                              type="text"
                              value={chatMessage}
                              onChange={(e) => setChatMessage(e.target.value)}
                              placeholder="Type your message..."
                            className="flex-1 min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                              maxLength={1500}
                          />
                          <button
                              type="submit"
                              disabled={!chatMessage.trim()}
                            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-maroon-600 text-white rounded-lg hover:bg-maroon-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex-shrink-0"
                            aria-label="Send message"
                          >
                            <PaperAirplaneIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Polls */}
                  <div className="lg:col-span-3">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col transition-all duration-300 ease-in-out" style={{ 
                      height: 'min(777px, calc(100vh - 16rem))', 
                      maxHeight: '777px', 
                      minHeight: 'clamp(400px, 50vh, 777px)' 
                    }}>
                      <div className="bg-maroon-700 text-white px-4 py-3 border-b border-maroon-800 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ChartBarIcon className="h-5 w-5" />
                            <h3 className="font-bold text-base">Polls & Results</h3>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="text-sm bg-white bg-opacity-20 px-2.5 py-1 rounded-full font-bold">{polls.length}</span>
                          <button
                              onClick={() => setShowPollCreation(!showPollCreation)}
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-base font-bold transition-all duration-200 ${
                                  showPollCreation
                                        ? "bg-white text-maroon-700 rotate-45"
                                      : "bg-white bg-opacity-20 hover:bg-opacity-30 text-white"
                              }`}
                              title="Create new poll"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Poll Creation Form - Expandable */}
                    {showPollCreation && (
                          <div className="border-b border-gray-200 dark:border-gray-700 bg-maroon-50 dark:bg-maroon-900/20 p-4">
                            <h4 className="text-sm font-semibold text-maroon-900 dark:text-maroon-100 mb-3">Create New Poll</h4>
                            <form onSubmit={handlePollSubmit} className="space-y-3">
                            <input
                                type="text"
                                value={newPoll.question}
                                onChange={(e) => setNewPoll((prev) => ({ ...prev, question: e.target.value }))}
                                placeholder="Ask your listeners a question..."
                                  className="w-full px-3 py-2 text-sm border-2 border-maroon-300 dark:border-maroon-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                required
                            />
                            <div className="space-y-2">
                              {newPoll.options.map((option, index) => (
                                  <div key={index} className="flex space-x-2">
                                    <input
                                        type="text"
                                        value={option}
                                        onChange={(e) => updatePollOption(index, e.target.value)}
                                        placeholder={`Option ${index + 1}`}
                                          className="flex-1 px-3 py-2 text-sm border-2 border-maroon-300 dark:border-maroon-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                    {newPoll.options.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => removePollOption(index)}
                                              className="px-2 py-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                        >
                                          <XMarkIcon className="h-4 w-4" />
                                        </button>
                                    )}
                                  </div>
                              ))}
                            </div>
                              <div className="flex items-center justify-between pt-2">
                              {newPoll.options.length < 5 && (
                                  <button
                                      type="button"
                                      onClick={addPollOption}
                                        className="text-sm text-maroon-700 hover:text-maroon-900 dark:text-maroon-300 dark:hover:text-maroon-100 font-medium"
                                  >
                                    + Add Option
                                  </button>
                              )}
                              <div className="flex space-x-2 ml-auto">
                                <button
                                    type="button"
                                    onClick={() => setShowPollCreation(false)}
                                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 font-medium"
                                >
                                  Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreatingPoll || !newPoll.question.trim()}
                                      className="px-4 py-2 bg-maroon-700 text-white rounded-lg hover:bg-maroon-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                                >
                                  {isCreatingPoll ? "Creating..." : "Create Poll"}
                                </button>
                              </div>
                            </div>
                          </form>
                        </div>
                    )}

                      <EnhancedScrollArea className="flex-1 min-h-0 flex-shrink-0">
                      {polls.length === 0 ? (
                          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                            <ChartBarIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No polls created yet</p>
                          </div>
                      ) : (
                          <div className="p-3 space-y-3">
                            {polls.map((poll) => {
                              const totalVotes = (() => {
                                try {
                                  return poll.options?.reduce((sum, option) => sum + (option.votes || 0), 0) || 0
                                } catch (error) {
                                  return 0
                                }
                              })()

                              return (
                                  <div
                                      key={poll.id}
                                      className={`rounded-lg border-2 p-3 ${
                                          activePoll?.id === poll.id
                                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                              : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
                                      }`}
                                  >
                                    <div className="mb-2">
                                      <h4 className="font-medium text-gray-900 dark:text-white text-xs">{poll.question}</h4>
                                      <div className="flex items-center justify-between mt-1">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  Total votes: {totalVotes}
                                </span>
                                        {poll.active ? (
                                            <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full">
                                    Active
                                  </span>
                                        ) : totalVotes > 0 ? (
                                            <span className="text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 px-2 py-0.5 rounded-full">
                                              Ended
                                            </span>
                                        ) : (
                                            <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 px-2 py-0.5 rounded-full">
                                              Draft
                                            </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="space-y-1.5">
                                      {(() => {
                                        try {
                                          return poll.options?.map((option, index) => {
                                            const percentage =
                                                totalVotes > 0 ? Math.round(((option.votes || 0) / totalVotes) * 100) : 0
                                            return (
                                                <div key={index} className="text-xs">
                                                  <div className="flex justify-between mb-0.5">
                                                    <span className="text-gray-700 dark:text-gray-300">{option.text}</span>
                                                    <span className="text-gray-600 dark:text-gray-400">
                                            {option.votes || 0} ({percentage}%)
                                          </span>
                                                  </div>
                                                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                                                    <div
                                                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                  </div>
                                                </div>
                                            )
                                          })
                                        } catch (error) {
                                          return <div className="text-xs text-gray-500">Error loading poll options</div>
                                        }
                                      })()}
                                    </div>
                                    {/* Poll Controls */}
                                    <div className="mt-2 flex items-center space-x-2 flex-wrap gap-2">
                                      {poll.active ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleEndPoll(poll.id)}
                                            className="px-3 py-1.5 text-xs bg-gold-500 text-maroon-900 rounded-lg hover:bg-gold-600 font-medium transition-colors"
                                            title="End poll - stops accepting votes but keeps showing results"
                                          >
                                            End
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeletePoll(poll.id)}
                                            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                                          >
                                            Delete
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handlePostPoll(poll.id)}
                                            className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                                            title={totalVotes > 0 ? "Repost poll with existing votes" : "Post poll"}
                                          >
                                            {totalVotes > 0 ? "Repost" : "Post"}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeletePoll(poll.id)}
                                            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                                          >
                                            Delete
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                              )
                            })}
                          </div>
                      )}
                    </EnhancedScrollArea>
                  </div>
                  </div>
                </div>
                </>
          )}

          {/* Step 1: Create Broadcast Content (BUTT workflow) */}
          {workflowState === WORKFLOW_STATES.CREATE_BROADCAST && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-visible mb-6 border-2 border-maroon-200 dark:border-maroon-900">
                <div className="p-6 relative z-0">
                  {/* Step Header */}
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-maroon-600 text-white font-bold text-lg shadow-md">
                        1
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Create New Broadcast
                  </h2>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 ml-14">Fill in the broadcast details below</p>
                  </div>
                  
                  {/* BUTT Info Banner */}
                  <div className="mb-6 p-4 bg-gold-50 dark:bg-gold-900/20 rounded-lg border border-gold-300 dark:border-gold-800">
                    <div className="flex items-start gap-3">
                      <SpeakerWaveIcon className="w-6 h-6 text-gold-600 dark:text-gold-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-maroon-900 dark:text-gold-200 mb-1">
                          Streaming with BUTT
                        </p>
                        <p className="text-sm text-maroon-800 dark:text-gold-300">
                          After creating your broadcast, you'll use <strong>BUTT (Broadcast Using This Tool)</strong> to stream your audio to the radio server.
                    </p>
                      </div>
                    </div>
                  </div>

                  {/* Main Form Content */}
                  <div className="space-y-6">
                    {/* Title and Description */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label htmlFor="title" className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Broadcast Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="title"
                            name="title"
                            value={broadcastForm.title}
                            onChange={handleFormChange}
                            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                            placeholder="e.g., Morning Show with DJ John"
                            disabled={isCreatingBroadcast}
                        />
                        {formErrors.title && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.title}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label
                            htmlFor="description"
                            className="block text-sm font-semibold text-gray-900 dark:text-gray-100"
                        >
                          Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            id="description"
                            name="description"
                            value={broadcastForm.description}
                            onChange={handleFormChange}
                            rows={3}
                            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all resize-none"
                            placeholder="Describe what your broadcast is about..."
                            disabled={isCreatingBroadcast}
                        />
                        {formErrors.description && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Enhanced Scheduling Toggle */}
                    <div className="space-y-4">
                      <button
                        type="button"
                        onClick={() => {
                          const newScheduled = !broadcastForm.isScheduled
                          setBroadcastForm(prev => ({
                            ...prev,
                            isScheduled: newScheduled,
                            scheduledDate: newScheduled ? prev.scheduledDate : "",
                            scheduledStartTime: newScheduled ? prev.scheduledStartTime : "",
                            scheduledEndTime: newScheduled ? prev.scheduledEndTime : "",
                          }))
                          clearFormError("scheduledDate")
                          clearFormError("scheduledStartTime")
                          clearFormError("scheduledEndTime")
                        }}
                        disabled={isCreatingBroadcast}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-300 ${
                          broadcastForm.isScheduled
                            ? "bg-gradient-to-r from-maroon-50 to-purple-50 dark:from-maroon-900/30 dark:to-purple-900/30 border-maroon-300 dark:border-maroon-700 shadow-lg"
                            : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-maroon-300 dark:hover:border-maroon-700"
                        } ${isCreatingBroadcast ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${broadcastForm.isScheduled ? "bg-maroon-100 dark:bg-maroon-900/50" : "bg-gray-200 dark:bg-gray-700"}`}>
                            <CalendarIcon className={`w-5 h-5 ${broadcastForm.isScheduled ? "text-maroon-600 dark:text-maroon-400" : "text-gray-500 dark:text-gray-400"}`} />
                          </div>
                          <div className="text-left">
                            <p className={`text-sm font-semibold ${broadcastForm.isScheduled ? "text-maroon-900 dark:text-maroon-200" : "text-gray-700 dark:text-gray-300"}`}>
                              {broadcastForm.isScheduled ? "Scheduled Broadcast" : "Schedule for Later"}
                            </p>
                            <p className={`text-xs ${broadcastForm.isScheduled ? "text-maroon-600 dark:text-maroon-400" : "text-gray-500 dark:text-gray-400"}`}>
                              {broadcastForm.isScheduled ? "Set your broadcast date and time" : "Click to schedule this broadcast"}
                            </p>
                          </div>
                        </div>
                        <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${broadcastForm.isScheduled ? "bg-maroon-600" : "bg-gray-300 dark:bg-gray-600"}`}>
                          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${broadcastForm.isScheduled ? "translate-x-6" : "translate-x-0"}`} />
                        </div>
                      </button>

                      {broadcastForm.isScheduled && (
                        <EnhancedScheduleForm
                          scheduledDate={broadcastForm.scheduledDate}
                          scheduledStartTime={broadcastForm.scheduledStartTime}
                          scheduledEndTime={broadcastForm.scheduledEndTime}
                          onDateChange={(date) => {
                            setBroadcastForm(prev => {
                              const newForm = { ...prev, scheduledDate: date }
                              
                              // Clear times if they become invalid after date change
                              if (date && prev.scheduledStartTime) {
                                const [year, month, day] = date.split("-").map(Number)
                                const [hours, minutes] = prev.scheduledStartTime.split(":").map(Number)
                                const selectedDateTime = new Date(year, month - 1, day, hours, minutes)
                                const now = new Date()
                                
                                // If the selected date+time is in the past, clear the times
                                if (selectedDateTime <= now) {
                                  newForm.scheduledStartTime = ""
                                  newForm.scheduledEndTime = ""
                                }
                              }
                              
                              return newForm
                            })
                            clearFormError("scheduledDate")
                            clearFormError("scheduledStartTime")
                            clearFormError("scheduledEndTime")
                          }}
                          onStartTimeChange={(time) => {
                            setBroadcastForm(prev => ({ ...prev, scheduledStartTime: time }))
                            clearFormError("scheduledStartTime")
                          }}
                          onEndTimeChange={(time) => {
                            setBroadcastForm(prev => ({ ...prev, scheduledEndTime: time }))
                            clearFormError("scheduledEndTime")
                          }}
                          formErrors={formErrors}
                          disabled={isCreatingBroadcast}
                        />
                      )}
                    </div>

                    {/* Enhanced Create Button */}
                    <div className="flex items-center justify-center pt-6 border-t border-gray-200 dark:border-gray-700">
                      <button
                          type="button"
                          onClick={createBroadcast}
                          disabled={isCreatingBroadcast || !broadcastForm.title.trim() || !broadcastForm.description.trim() || (broadcastForm.isScheduled && (!broadcastForm.scheduledDate || !broadcastForm.scheduledStartTime || !broadcastForm.scheduledEndTime))}
                          className="group relative px-10 py-4 bg-gradient-to-r from-maroon-600 to-maroon-700 text-white rounded-xl hover:from-maroon-700 hover:to-maroon-800 focus:outline-none focus:ring-4 focus:ring-maroon-300 focus:ring-offset-2 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-300 text-lg font-semibold shadow-lg hover:shadow-2xl disabled:shadow-none transform hover:scale-105 disabled:transform-none overflow-hidden"
                      >
                        {/* Shine effect */}
                        <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        
                        {/* Button content */}
                        <span className="relative flex items-center justify-center gap-2">
                          {isCreatingBroadcast ? (
                            <>
                              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Creating Broadcast...</span>
                            </>
                          ) : (
                            <>
                              <PlusIcon className="w-5 h-5" />
                              <span>Create Broadcast</span>
                              <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </>
                          )}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
          )}

          {/* Step 2: Ready to Stream (BUTT workflow) */}
          {workflowState === WORKFLOW_STATES.READY_TO_STREAM && currentBroadcast && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-6 border-2 border-maroon-200 dark:border-maroon-900">
                <div className="p-6">
                  {/* Step Header */}
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-maroon-600 text-white font-bold text-lg shadow-md">
                        2
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Ready to Stream
                  </h2>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 ml-14">Follow the steps below to start your broadcast</p>
                  </div>

                  {/* Broadcast Info */}
                  <div className="mb-6 p-4 bg-maroon-50 dark:bg-maroon-900/20 rounded-lg border border-maroon-200 dark:border-maroon-800">
                    <h3 className="text-lg font-semibold text-maroon-900 dark:text-maroon-100 mb-1">
                      {currentBroadcast.title}
                    </h3>
                    <p className="text-sm text-maroon-800 dark:text-maroon-200">{currentBroadcast.description}</p>
                  </div>

                  {/* Radio Server Error */}
                  {radioServerError && (
                    <div className="mb-6 p-4 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200 rounded-lg border border-red-300 dark:border-red-800">
                      <strong>Radio Server Error:</strong> {radioServerError}
                    </div>
                  )}

                  {/* Step-by-Step Instructions */}
                  <div className="space-y-6">
                    {/* Step 1: Start Radio Server */}
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-5 border-2 border-emerald-300 dark:border-emerald-800">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg ${
                            radioServerState === 'running' 
                              ? 'bg-green-600 text-white shadow-lg' 
                              : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>
                            1
                      </div>
                            </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                            Start Radio Server
                          </h3>
                          <div className="flex items-center gap-2 mb-4">
                            <span className={`h-3 w-3 rounded-full ${radioServerState === 'running' ? 'bg-green-500 animate-pulse' : radioServerState === 'stopped' ? 'bg-gray-400' : 'bg-yellow-500'}`}></span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              Server Status: <span className={
                                radioServerState === 'running' ? 'text-green-600 dark:text-green-400 font-semibold' :
                                radioServerState === 'unknown' ? 'text-yellow-600 dark:text-yellow-400' :
                                'text-red-600 dark:text-red-400'
                              }>
                                {radioServerState === 'running' ? '✓ Running' : radioServerState === 'stopped' ? 'Offline' : 'Checking...'}
                              </span>
                            </span>
                          </div>
                          <div className="flex gap-3 mb-3">
                          <button
                            onClick={handleStartRadioServer}
                            disabled={isStartingServer || radioServerState === 'running'}
                              className="flex-1 flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-300 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all text-base font-semibold shadow-lg hover:shadow-xl disabled:shadow-none"
                          >
                            <MicrophoneIcon className="h-5 w-5 mr-2" />
                              {isStartingServer ? 'Starting...' : radioServerState === 'running' ? '✓ Server Running' : 'Start Radio Server'}
                          </button>
                            {radioServerState === 'running' && (
                          <button
                            onClick={handleStopRadioServer}
                                disabled={isStoppingServer}
                                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-300 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all text-base font-semibold"
                          >
                                <StopIcon className="h-5 w-5 mr-2 inline" />
                                Stop Server
                          </button>
                            )}
                        </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            The radio server must be running before you can stream. Once started, it will stay running until you stop it.
                        </p>
                        </div>
                      </div>
                      </div>

                    {/* Step 2: Connect BUTT */}
                    <div className={`rounded-lg p-5 border-2 ${
                      radioServerState === 'running'
                        ? 'bg-gold-50 dark:bg-gold-900/20 border-gold-300 dark:border-gold-800'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 opacity-60'
                    }`}>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg ${
                            radioServerState === 'running'
                              ? 'bg-gold-500 text-maroon-900 shadow-lg'
                              : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>
                            2
                          </div>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                            Connect BUTT (Broadcast Using This Tool)
                          </h3>
                          {radioServerState === 'running' ? (
                            <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-decimal list-inside mb-4">
                              <li>Open <strong>BUTT</strong> on your computer</li>
                              <li>Configure BUTT to connect to <strong>Icecast port 9000</strong></li>
                              <li>Click <strong>"Play"</strong> in BUTT to start streaming</li>
                              <li>Once audio is streaming, click <strong>"Go Live"</strong> below</li>
                        </ol>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-4">
                              Start the radio server first (Step 1) to see connection instructions.
                            </p>
                          )}
                          {radioServerState === 'running' && (
                            <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gold-300 dark:border-gold-700">
                              <p className="text-xs font-semibold text-maroon-900 dark:text-gold-200 mb-1">Connection Details:</p>
                              <p className="text-xs text-maroon-800 dark:text-gold-300">
                                Server: <code className="bg-maroon-100 dark:bg-maroon-900/50 px-1 rounded">localhost:9000</code> | 
                                Format: <code className="bg-maroon-100 dark:bg-maroon-900/50 px-1 rounded">MP3</code>
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Go Live Button */}
                    <div className={`rounded-lg p-5 border-2 ${
                      radioServerState === 'running'
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 opacity-60'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                            Go Live
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {radioServerState === 'running' 
                              ? 'Once BUTT is streaming, click below to go live and open the interactive dashboard'
                              : 'Start the radio server first (Step 1) to enable this action'}
                          </p>
                        </div>
                        <button
                          onClick={startBroadcastLive}
                          disabled={radioServerState !== 'running' || currentBroadcast?.status === 'LIVE'}
                          className={`ml-6 flex items-center px-8 py-4 rounded-lg font-bold text-lg transition-all shadow-lg ${
                            radioServerState === 'running' && currentBroadcast?.status !== 'LIVE'
                              ? 'bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-300 hover:shadow-xl'
                              : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                          }`}
                          title={
                            currentBroadcast?.status === 'LIVE'
                              ? 'Broadcast is already live'
                              : radioServerState !== 'running'
                                ? 'Start the radio server first'
                                : 'Go live and open the interactive dashboard'
                          }
                        >
                          <MicrophoneIcon className="h-6 w-6 mr-2" />
                          {currentBroadcast?.status === 'LIVE' ? 'Broadcast Already Live' : 'Go Live'}
                        </button>
                      </div>
                    </div>

                    {/* Additional Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Stream Preview */}
                      <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Stream Preview</h3>
                        <AudioPlayer isPreview={true} />
                      </div>

                      {/* Chat Slow Mode */}
                      {currentBroadcast && (
                        <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Chat Slow Mode</h3>
                          <div className="space-y-3">
                            <label className="flex items-center text-sm">
                              <input
                                type="checkbox"
                                className="mr-2"
                                checked={slowModeEnabled}
                                onChange={(e) => setSlowModeEnabled(e.target.checked)}
                              />
                              Enable slow mode
                            </label>
                            {slowModeEnabled && (
                              <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                max={3600}
                                value={slowModeSeconds}
                                onChange={(e) => setSlowModeSeconds(e.target.value)}
                                className="w-24 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                placeholder="seconds"
                              />
                                <span className="text-xs text-gray-500 dark:text-gray-400">seconds between messages</span>
                            </div>
                            )}
                            <button
                              onClick={handleSaveSlowMode}
                              disabled={isSavingSlowMode}
                              className="w-full px-3 py-2 bg-maroon-700 text-white rounded-md hover:bg-maroon-800 disabled:opacity-50 text-sm font-medium"
                            >
                              {isSavingSlowMode ? 'Saving…' : 'Save Settings'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cancel Option */}
                    <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={cancelBroadcast}
                          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors text-sm font-medium"
                        >
                        <XMarkIcon className="h-4 w-4 mr-1 inline" />
                          Cancel Broadcast
                        </button>
                    </div>
                  </div>
                </div>
              </div>
          )}

        </div>
      </div>
  )
}

// Bare-bones note: DJDashboard component kept as-is for stability.
