import { useState, useEffect, useRef } from 'react';
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
  XCircleIcon,
  TrashIcon,
  PlusCircleIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import { broadcastService, serverService, pollService, chatService, songRequestService, streamService } from '../services/api';
import Toast from '../components/Toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { createAudioAnalyser, getAudioLevel, startVisualization, getAudioInputDevices, getMicrophoneStream } from '../util/audio';

export default function DJDashboard() {
  // Broadcast state
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [audioInputLevel, setAudioInputLevel] = useState(0);
  const [audioInputDevice, setAudioInputDevice] = useState('default');
  const [availableAudioDevices, setAvailableAudioDevices] = useState([]);
  const [currentBroadcastId, setCurrentBroadcastId] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [isPreviewingAudio, setIsPreviewingAudio] = useState(false);
  const [audioStream, setAudioStream] = useState(null);
  const [audioContext, setAudioContext] = useState(null);
  const [audioAnalyser, setAudioAnalyser] = useState(null);

  // WebSocket streaming refs and state
  const websocketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingError, setStreamingError] = useState(null);
  const [websocketConnected, setWebSocketConnected] = useState(false);

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

  // UI state for toasts and modals
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [scheduleToDelete, setScheduleToDelete] = useState(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusModal, setStatusModal] = useState({ isOpen: false, message: '', type: 'success' });
  const [scheduleStatusModal, setScheduleStatusModal] = useState({ isOpen: false, message: '', type: 'success' });
  const [scheduleFormModal, setScheduleFormModal] = useState({ isOpen: false, isEdit: false });

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

  // Additional states for DJ Dashboard
  const [isPlaying, setIsPlaying] = useState(false);
  const [meterLevel, setMeterLevel] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [statusMessage, setStatusMessage] = useState('Standby');
  const [isServerRunning, setIsServerRunning] = useState(false);

  // Visualization stop function ref
  const visualizationStopRef = useRef(null);

  // Stream connection and timeout refs
  const streamConnection = useRef(null);
  const streamConnectionTimeout = useRef(null);

  // Fetch server status when component mounts
  useEffect(() => {
    const fetchServerStatus = async () => {
      try {
        const statusResponse = await serverService.getStatus();
        setServerRunning(statusResponse.data);
      } catch (error) {
        console.error('Error fetching server status:', error);
        setServerRunning(false);
      }
    };

    fetchServerStatus();

    // Set up interval to check server status every 30 seconds
    const interval = setInterval(fetchServerStatus, 30000);
    
    // Clean up interval on component unmount
    return () => clearInterval(interval);
  }, []);

  // Get available audio devices
  const getAudioDevices = async () => {
    try {
      // Check if MediaDevices API is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.error('MediaDevices API not supported in this browser');
        setToast({ 
          visible: true, 
          message: 'Audio input detection not supported in this browser', 
          type: 'error' 
        });
        return;
      }

      // Request audio permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get all devices
      const devices = await navigator.mediaDevices.enumerateDevices();

      // Filter for audio input devices and map to our format
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          id: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 5)}...`
        }));

      if (audioInputs.length === 0) {
        console.warn('No audio input devices detected');
        setToast({ 
          visible: true, 
          message: 'No microphones detected. Please connect a microphone.', 
          type: 'warning' 
        });
      } else {
        console.log('Available audio devices:', audioInputs);

        // Update state with found devices
        setAvailableAudioDevices(audioInputs);

        // Set default device if none is selected
        if (audioInputDevice === 'default' && audioInputs.length > 0) {
          setAudioInputDevice(audioInputs[0].id);
        }
      }
    } catch (error) {
      console.error('Error accessing microphone:', error);

      let errorMessage = 'Could not access microphone. ';

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage += 'Microphone permission was denied. Please check your browser settings.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No microphone found. Please connect a microphone.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage += 'Microphone is already in use by another application.';
      } else {
        errorMessage += 'Please check your permissions and try again.';
      }

      setToast({ 
        visible: true, 
        message: errorMessage, 
        type: 'error' 
      });

      setAvailableAudioDevices([]);
    }
  };

  // Add this function after the getAudioDevices function
  // Handle audio device change
  const handleAudioDeviceChange = (e) => {
    const deviceId = e.target.value;
    console.log('Audio input device changed to:', deviceId);
    setAudioInputDevice(deviceId);

    // If currently previewing audio, restart the preview with the new device
    if (isPreviewingAudio) {
      stopStreaming(); // Stop current preview
      setTimeout(() => {
        toggleAudioPreview(); // Restart with new device
      }, 300);
    }
  };

  // Connect to WebSocket server for streaming
  const connectWebSocket = async () => {
    try {
      console.log('Connecting to WebSocket for streaming...');

      // Close any existing connection first
      if (websocketRef.current) {
        try {
          if (websocketRef.current.readyState === WebSocket.OPEN || 
              websocketRef.current.readyState === WebSocket.CONNECTING) {
            websocketRef.current.close();
            console.log('Closed existing WebSocket connection');
          }
        } catch (error) {
          console.error('Error closing existing WebSocket:', error);
        }
        websocketRef.current = null;
      }

      // Create WebSocket connection
      const wsUrl = streamService.getStreamUrl();
      console.log(`Using WebSocket URL: ${wsUrl}`);

      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      websocketRef.current = ws;

      // Set up WebSocket event handlers
      ws.onopen = () => {
        console.log('WebSocket connection established');
        retryCountRef.current = 0;
        setWebSocketConnected(true);

        // Add a slight delay before starting the recording to ensure everything is initialized
        setTimeout(() => {
          // Send a test message to verify the connection is working
          try {
            // Create a small test audio buffer (1ms of silence)
            const testBuffer = new ArrayBuffer(16);
            ws.send(testBuffer);
            console.log('Sent test data to WebSocket');

            // Now start recording
            startRecording(ws);
          } catch (e) {
            console.error('Error sending test data to WebSocket:', e);
            // Still try to start recording
            startRecording(ws);
          }
        }, 300); // 300ms delay should be enough for initialization

        setStatusMessage('LIVE ON AIR');

        // Update state to show connection
        setToast({
          visible: true,
          message: 'Broadcasting started. You are now live!',
          type: 'success'
        });
      };

      ws.onclose = (event) => {
        console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);

        if (isStreaming && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          const backoffTime = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
          console.log(`Attempting to reconnect (${retryCountRef.current}/${MAX_RETRIES}) in ${backoffTime/1000} seconds...`);

          // Show toast to inform user
          setToast({
            visible: true,
            message: `Connection lost. Reconnecting (attempt ${retryCountRef.current}/${MAX_RETRIES})...`,
            type: 'warning'
          });

          setTimeout(connectWebSocket, backoffTime);
        } else if (retryCountRef.current >= MAX_RETRIES) {
          console.error(`Maximum retry attempts (${MAX_RETRIES}) reached. Stopping stream.`);
          setToast({
            visible: true,
            message: 'Unable to establish connection. Broadcast stopped.',
            type: 'error'
          });
          stopStreaming();
          setIsBroadcasting(false);
          setCurrentBroadcastId(null);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStreamingError('Connection error occurred');
        setToast({
          visible: true,
          message: 'WebSocket connection error. Please try again.',
          type: 'error'
        });
      };

      return ws;
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setStreamingError(`Connection error: ${error.message}`);

      setToast({
        visible: true,
        message: `Failed to connect: ${error.message}`,
        type: 'error'
      });

      if (isStreaming && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        const backoffTime = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
        setTimeout(connectWebSocket, backoffTime);
      } else if (retryCountRef.current >= MAX_RETRIES) {
        setIsStreaming(false);
        stopStreaming();
        setIsBroadcasting(false);
        setCurrentBroadcastId(null);
      }

      return null;
    }
  };

  // Start recording audio and sending via WebSocket
  const startRecording = (ws) => {
    if (!audioStream) {
      console.error('Cannot start recording: missing audio stream');
      setToast({
        visible: true,
        message: 'Cannot start recording: No microphone connected',
        type: 'error'
      });
      return;
    }

    if (!ws && !websocketRef.current) {
      console.error('Cannot start recording: missing WebSocket connection');
      setToast({
        visible: true,
        message: 'Cannot start recording: No connection to server',
        type: 'error'
      });
      return;
    }

    // Use the passed websocket or the stored one
    const websocket = ws || websocketRef.current;

    // Store the websocket in ref if not already stored
    if (ws && (!websocketRef.current || websocketRef.current !== ws)) {
      websocketRef.current = ws;
    }

    try {
      // Find supported audio format - this is critical for FFmpeg compatibility
      const options = {
        mimeType: 'audio/webm',
        audioBitsPerSecond: 128000
      };

      // Try to find a supported mime type with fallbacks
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options.mimeType = 'audio/webm;codecs=opus';
          console.log('Using audio/webm;codecs=opus format');
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          options.mimeType = 'audio/ogg;codecs=opus';
          console.log('Using audio/ogg;codecs=opus format');
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options.mimeType = 'audio/mp4';
          console.log('Using audio/mp4 format');
        } else {
          console.warn('No supported audio format found, using default');
        }
      } else {
        console.log('Using audio/webm format');
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(audioStream, options);

      // Set up event handlers
      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0 && websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
          try {
            const arrayBuffer = await e.data.arrayBuffer();
            console.log(`Sending ${arrayBuffer.byteLength} bytes of audio data to server`);
            websocketRef.current.send(arrayBuffer);
          } catch (error) {
            console.error('Error sending audio data:', error);
            if (error.message.includes("null") && isStreaming) {
              // Socket has disconnected unexpectedly
              console.warn("Socket disconnected unexpectedly, attempting to reconnect");
              setTimeout(connectWebSocket, 1000);
            }
          }
        } else if (websocketRef.current && websocketRef.current.readyState !== WebSocket.OPEN && isStreaming) {
          console.warn(`WebSocket not in OPEN state (current state: ${websocketRef.current.readyState})`);
          if (isStreaming && websocketRef.current.readyState === WebSocket.CLOSED) {
            console.warn("WebSocket closed but still streaming, attempting to reconnect");
            setTimeout(connectWebSocket, 1000);
          }
        }
      };

      mediaRecorder.onstart = () => {
        console.log('MediaRecorder started');
        setIsStreaming(true);
        setStatusMessage('LIVE ON AIR');
      };

      mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped');
      };

      mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error:', error);
        setStreamingError(`Recording error: ${error.message}`);
        setToast({
          visible: true,
          message: `Recording error: ${error.message}`,
          type: 'error'
        });
      };

      // Start recording with small chunks (100ms) for smoother streaming
      // This chunk size is important and worked well in websocket-test.html
      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;

      // Update state
      setIsStreaming(true);
      setStreamingError(null);
    } catch (error) {
      console.error('Error starting MediaRecorder:', error);
      setStreamingError(`Recording error: ${error.message}`);
      setToast({
        visible: true,
        message: `Failed to start recording: ${error.message}`,
        type: 'error'
      });
      stopStreaming();
      setIsBroadcasting(false);
      setCurrentBroadcastId(null);
    }
  };

  /**
   * Clean up streaming resources
   */
  const stopStreaming = () => {
    setIsStreaming(false);
    
    // Stop audio capture
    if (audioContext) {
      try {
        const tracks = audioStream?.getTracks() || [];
        tracks.forEach(track => track.stop());
        
        audioContext.close().catch(e => console.error('Error closing audio context:', e));
        setAudioContext(null);
        setAudioAnalyser(null);
        setAudioStream(null);
      } catch (e) {
        console.error('Error stopping audio tracks:', e);
      }
    }
    
    // Close original WebSocket connection
    if (websocketRef.current) {
      try {
        websocketRef.current.close();
        websocketRef.current = null;
      } catch (e) {
        console.error('Error closing WebSocket connection:', e);
      }
    }
    
    // Close enhanced WebSocket connection
    if (streamConnection.current) {
      try {
        streamConnection.current.close(1000, 'Stream ended by user');
        streamConnection.current = null;
      } catch (e) {
        console.error('Error closing WebSocket connection:', e);
      }
    }
    
    // Clear any pending reconnection attempts
    if (streamConnectionTimeout.current) {
      clearTimeout(streamConnectionTimeout.current);
      streamConnectionTimeout.current = null;
    }
    
    // Stop media recorder if running
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      } catch (e) {
        console.error('Error stopping media recorder:', e);
      }
    }

    // Stop visualization if it's running
    if (visualizationStopRef.current) {
      visualizationStopRef.current();
      visualizationStopRef.current = null;
    }
    
    setWebSocketConnected(false);
    retryCountRef.current = 0;
    setStreamingError(null);
    setIsLoading(false);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (visualizationStopRef.current) {
        visualizationStopRef.current();
      }

      stopStreaming();
    };
  }, []);

  // Start or stop audio preview
  const toggleAudioPreview = async () => {
    if (isPreviewingAudio) {
      // Stop preview
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      if (audioContext) {
        audioContext.close();
      }

      // Short delay to allow state to update
      setTimeout(() => {
        toggleAudioPreview();
      }, 100);
    }
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

  // Enhanced toggleBroadcast function that includes WebSocket streaming
  const toggleBroadcast = async () => {
    if (isBroadcasting) {
      // Stop broadcasting
      try {
        // Stop streaming first
        stopStreaming();

        setIsLoading(true);

        // End the broadcast in the backend
        if (currentBroadcastId) {
          await broadcastService.end(currentBroadcastId);

          // Also call the stream stop endpoint
          try {
            // Try to use stop() first, fallback to stopStream() if it exists
            if (typeof streamService.stop === 'function') {
              await streamService.stop();
            } else if (typeof streamService.stopStream === 'function') {
              await streamService.stopStream();
            } else {
              console.warn('No stop stream function available');
            }
          } catch (streamError) {
            console.error('Error stopping stream:', streamError);
            // Continue execution despite this error
          }

          setToast({
            visible: true,
            message: 'Broadcast ended successfully',
            type: 'success'
          });
        }

        setIsBroadcasting(false);
        setCurrentBroadcastId(null);
        setStatusMessage('Standby');
      } catch (error) {
        console.error('Error ending broadcast:', error);
        setToast({
          visible: true,
          message: 'Error ending broadcast: ' + error.message,
          type: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      // Start broadcasting
      try {
        setIsLoading(true);

        // Find a scheduled broadcast to start, or create a new one
        let broadcastToStart;

        // Look for a scheduled broadcast that hasn't started yet
        if (broadcasts.length > 0) {
          broadcastToStart = broadcasts.find(b => b.status === 'SCHEDULED');
        }

        let broadcastId;
        if (broadcastToStart) {
          // Start an existing scheduled broadcast
          const response = await broadcastService.start(broadcastToStart.id);
          broadcastId = broadcastToStart.id;
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
          broadcastId = createdBroadcast.id;
        }

        setCurrentBroadcastId(broadcastId);
        setIsBroadcasting(true);
        setTestMode(false);

        // Authorize stream start via API
        try {
          let streamResponse;
          
          // Try to use start() first, fallback to startStream() if it exists
          if (typeof streamService.start === 'function') {
            streamResponse = await streamService.start();
          } else if (typeof streamService.startStream === 'function') {
            streamResponse = await streamService.startStream();
          } else {
            throw new Error('No start stream function available');
          }
          
          console.log('Stream authorized', streamResponse);

          // Get WebSocket URL from response if available
          const wsUrl = streamResponse.data?.streamUrl || streamService.getStreamUrl();

          // Start audio streaming
          startStreaming(wsUrl);

          setStatusMessage('LIVE');
          setToast({
            visible: true,
            message: 'Broadcast started successfully',
            type: 'success'
          });
        } catch (error) {
          console.error('Error authorizing stream:', error);
          setToast({
            visible: true,
            message: 'Stream authorization failed. Please check that you have DJ permissions.',
            type: 'error'
          });

          // Revert the broadcast state
          try {
            await broadcastService.end(broadcastId);
          } catch (endError) {
            console.error('Error ending broadcast after failed authorization:', endError);
          }

          setIsBroadcasting(false);
          setCurrentBroadcastId(null);
          setStatusMessage('Standby');
          return;
        }
      } catch (error) {
        console.error('Error starting broadcast:', error);
        setToast({
          visible: true,
          message: 'Error starting broadcast: ' + error.message,
          type: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  /**
   * Initialize audio streaming
   */
  const startStreaming = () => {
    // Don't attempt to connect if not broadcasting or if there's an active stream
    if (!isBroadcasting || streamConnection.current) {
      return;
    }

    setIsLoading(true);
    setStreamingError(null); // Clear any previous errors

    // Function to reconnect WebSocket with exponential backoff
    const connectWithRetry = (attempt = 0, maxAttempts = 3) => {
      try {
        console.log(`Attempting to connect to WebSocket stream (attempt ${attempt + 1}/${maxAttempts})...`);
        
        // Get proper WebSocket URL
        let wsUrl = streamService.getStreamUrl();
        
        // Fix the URL protocol based on the current page's protocol
        // This handles mixed content issues when page is served over HTTPS
        if (window.location.protocol === 'https:' && wsUrl.startsWith('ws://')) {
          wsUrl = wsUrl.replace('ws://', 'wss://');
          console.log('Updated WebSocket URL to use secure protocol:', wsUrl);
        }
        
        console.log(`Connecting to WebSocket: ${wsUrl}`);
        
        // Close any existing connection
        if (streamConnection.current) {
          try {
            streamConnection.current.close();
          } catch (e) {
            console.warn("Error closing existing connection:", e);
          }
          streamConnection.current = null;
        }
        
        // Create new WebSocket connection with proper error handling
        try {
          // Check websocket URL format
          if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
            throw new Error(`Invalid WebSocket URL format: ${wsUrl}`);
          }
          
          // Check if backend server is reachable first
          fetch(wsUrl.replace('ws://', 'http://').replace('wss://', 'https://'))
            .then(() => console.log('Backend server is reachable'))
            .catch(e => console.warn('Backend HTTP check failed, but will still try WebSocket:', e));
          
          console.log(`Creating WebSocket with URL: ${wsUrl}`);
          const socket = new WebSocket(wsUrl);
          socket.binaryType = "arraybuffer"; // Important for binary audio data
          
          // Track connection state
          let isConnected = false;
          let reconnectTimeout = null;
          
          // Add connection timeout safety
          const connectionTimeout = setTimeout(() => {
            if (!isConnected) {
              console.warn("WebSocket connection timed out");
              socket.close(4000, "Connection timeout");
              
              // Attempt server ping check
              fetch('/api/stream/diagnostics')
                .then(res => res.json())
                .then(data => {
                  console.log('Server diagnostics check:', data);
                  
                  // If server is online but connection failed, try a different URL format
                  if (data.server === 'UP') {
                    console.log('Server is UP but WebSocket failed - trying alternate connection method');
                    
                    // Try reconnecting with a different URL format - omit port or use different one
                    const altUrl = wsUrl.includes(':8080') 
                      ? wsUrl.replace(':8080', '') 
                      : wsUrl.replace('/stream', ':443/stream');
                    
                    console.log('Attempting alternate URL:', altUrl);
                    
                    try {
                      const altSocket = new WebSocket(altUrl);
                      altSocket.binaryType = "arraybuffer";
                      altSocket.onopen = () => {
                        console.log('Alternate WebSocket connection successful!');
                        streamConnection.current = altSocket;
                        startAudioCapture()
                          .then(() => {
                            setIsStreaming(true);
                            setIsLoading(false);
                          })
                          .catch(error => {
                            console.error('Error starting audio capture:', error);
                            stopStreaming();
                            setStreamingError('Failed to access microphone. Please check your permissions and try again.');
                          });
                      };
                      altSocket.onerror = (e) => {
                        console.error('Alternate WebSocket connection also failed:', e);
                        // Retry with original mechanism
                        if (attempt < maxAttempts) {
                          const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
                          reconnectTimeout = setTimeout(() => {
                            connectWithRetry(attempt + 1, maxAttempts);
                          }, backoffDelay);
                        }
                      };
                    } catch (e) {
                      console.error('Error creating alternate WebSocket:', e);
                    }
                  }
                })
                .catch(e => {
                  console.error('Error checking server diagnostics:', e);
                  // Try again if we haven't exceeded max attempts
                  if (attempt < maxAttempts) {
                    const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
                    console.log(`Connection timed out. Will retry in ${backoffDelay}ms...`);
                    reconnectTimeout = setTimeout(() => {
                      connectWithRetry(attempt + 1, maxAttempts);
                    }, backoffDelay);
                  } else {
                    console.error('Max reconnection attempts reached after timeout');
                    setStreamingError('Connection timeout. Please try again later.');
                    setIsLoading(false);
                    stopStreaming();
                  }
                });
            }
          }, 10000); // 10 second connection timeout
          
          // Handle WebSocket open event
          socket.onopen = () => {
            console.log('WebSocket connection established for streaming');
            isConnected = true;
            clearTimeout(connectionTimeout); // Clear the connection timeout
            streamConnection.current = socket;
            setIsLoading(false);
            
            // Start capturing and sending audio data
            startAudioCapture()
              .then(() => {
                // Success callback
                setIsStreaming(true);
                console.log('Audio capture started successfully');
                
                // Send a small test packet to verify the connection
                const testData = new ArrayBuffer(4);
                try {
                  socket.send(testData);
                  console.log("Sent test data packet");
                } catch (e) {
                  console.error("Error sending test packet:", e);
                }
              })
              .catch(error => {
                console.error('Error starting audio capture:', error);
                stopStreaming();
                setStreamingError('Failed to access microphone. Please check your permissions and try again.');
              });
          };
          
          // Handle WebSocket messages
          socket.onmessage = (event) => {
            try {
              // Check if the message is binary or text
              if (typeof event.data === 'string') {
                try {
                  const data = JSON.parse(event.data);
                  // Handle server messages
                  if (data.type === 'SERVER_STATUS') {
                    // Update UI based on server status
                    console.log('Server status update:', data);
                  } else if (data.status === 'connected') {
                    console.log('Server confirmed connection');
                  } else {
                    console.log('Received message from server:', data);
                  }
                } catch (e) {
                  console.warn('Received non-JSON message from server:', event.data);
                }
              } else {
                // Binary message - likely response to our test packet
                console.log('Received binary response from server, size:', event.data?.byteLength || 'unknown');
              }
            } catch (e) {
              console.warn('Error processing message:', e);
            }
          };
          
          // Handle WebSocket errors
          socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            
            // Log more detailed information if available
            if (error.message) {
              console.error('Error message:', error.message);
            }
            
            setStreamingError('Connection error occurred. Please try again.');
            
            // Check if it's a security error or mixed content issue
            const errorStr = error.toString().toLowerCase();
            if (errorStr.includes('security') || errorStr.includes('mixed content')) {
              console.error('Likely a security/mixed content issue. Will try secure connection next.');
              if (wsUrl.startsWith('ws://')) {
                // Try with secure protocol instead
                wsUrl = wsUrl.replace('ws://', 'wss://');
                console.log('Trying secure connection:', wsUrl);
                
                try {
                  socket.close();
                  
                  setTimeout(() => {
                    const secureSocket = new WebSocket(wsUrl);
                    secureSocket.binaryType = "arraybuffer";
                    
                    // Set up basic handlers for the secure socket attempt
                    secureSocket.onopen = () => {
                      console.log('Secure WebSocket connection succeeded!');
                      isConnected = true;
                      streamConnection.current = secureSocket;
                      
                      // Start capturing and sending audio data
                      startAudioCapture()
                        .then(() => {
                          setIsStreaming(true);
                        })
                        .catch(e => {
                          console.error('Error starting audio capture with secure connection:', e);
                          stopStreaming();
                        });
                    };
                    
                    secureSocket.onerror = (secureError) => {
                      console.error('Secure WebSocket also failed:', secureError);
                      
                      // Regular reconnect logic if secure attempt also fails
                      if (attempt < maxAttempts) {
                        const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
                        console.log(`Will attempt to reconnect in ${backoffDelay}ms...`);
                        
                        reconnectTimeout = setTimeout(() => {
                          connectWithRetry(attempt + 1, maxAttempts);
                        }, backoffDelay);
                      }
                    };
                  }, 1000);
                  
                  return; // Skip regular reconnect logic since we're trying secure connection
                } catch (e) {
                  console.error('Failed to create secure WebSocket:', e);
                  // Continue with regular reconnect logic
                }
              }
            }
            
            if (isConnected) {
              // If we were previously connected, attempt to reconnect
              isConnected = false;
              
              if (attempt < maxAttempts) {
                const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
                console.log(`Will attempt to reconnect in ${backoffDelay}ms...`);
                
                reconnectTimeout = setTimeout(() => {
                  connectWithRetry(attempt + 1, maxAttempts);
                }, backoffDelay);
              } else {
                console.error('Max reconnection attempts reached');
                setStreamingError('Connection lost and could not be re-established.');
                stopStreaming();
              }
            } else {
              // If we were not connected, stop immediately
              clearTimeout(connectionTimeout);
              stopStreaming();
              setIsLoading(false);
              
              // Try again if we haven't exceeded max attempts
              if (attempt < maxAttempts) {
                const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
                console.log(`Will attempt to reconnect in ${backoffDelay}ms...`);
                
                reconnectTimeout = setTimeout(() => {
                  connectWithRetry(attempt + 1, maxAttempts);
                }, backoffDelay);
              }
            }
          };
          
          // Handle WebSocket close
          socket.onclose = (event) => {
            console.log(`WebSocket closed: ${event.code} - ${event.reason || 'No reason provided'}`);
            setIsStreaming(false);
            clearTimeout(connectionTimeout);
            
            // Log detailed information about closure codes
            let codeExplanation = "";
            switch (event.code) {
              case 1000: codeExplanation = "Normal closure"; break;
              case 1001: codeExplanation = "Going away"; break;
              case 1002: codeExplanation = "Protocol error"; break;
              case 1003: codeExplanation = "Unsupported data"; break;
              case 1005: codeExplanation = "No status received"; break;
              case 1006: codeExplanation = "Abnormal closure"; break;
              case 1007: codeExplanation = "Invalid frame payload data"; break;
              case 1008: codeExplanation = "Policy violation"; break;
              case 1009: codeExplanation = "Message too big"; break;
              case 1010: codeExplanation = "Missing extension"; break;
              case 1011: codeExplanation = "Internal error"; break;
              case 1012: codeExplanation = "Service restart"; break;
              case 1013: codeExplanation = "Try again later"; break;
              case 1014: codeExplanation = "Bad gateway"; break;
              case 1015: codeExplanation = "TLS handshake"; break;
              case 4000: codeExplanation = "Connection timeout"; break;
              default: codeExplanation = "Unknown reason";
            }
            console.warn(`WebSocket close code ${event.code} means: ${codeExplanation}`);
            
            const wasStoppingIntentionally = !isBroadcasting;
            
            // For code 1006 (Abnormal closure), try a direct HTTP check to see if the server is even available
            if (event.code === 1006) {
              console.log('Abnormal closure detected, checking if server is reachable...');
              fetch('/api/stream/status')
                .then(res => res.json())
                .then(status => {
                  console.log('Server status check result:', status);
                  if (status.server === 'UP') {
                    console.log('Server is running, but WebSocket connection failed. Will try again with different protocol.');
                    
                    // If server is up but WebSocket failed, try with different protocol
                    const newWsUrl = wsUrl.startsWith('ws://') 
                      ? wsUrl.replace('ws://', 'wss://') 
                      : wsUrl.replace('wss://', 'ws://');
                    
                    console.log(`Trying with alternative protocol: ${newWsUrl}`);
                    
                    setTimeout(() => {
                      try {
                        const altSocket = new WebSocket(newWsUrl);
                        altSocket.binaryType = "arraybuffer";
                        altSocket.onopen = () => {
                          console.log('Alternative protocol connection successful!');
                          streamConnection.current = altSocket;
                          startAudioCapture()
                            .then(() => {
                              setIsStreaming(true);
                            })
                            .catch(error => {
                              console.error('Error starting audio capture with alt protocol:', error);
                              stopStreaming();
                            });
                        };
                        altSocket.onerror = () => {
                          console.error('Alternative protocol also failed.');
                          if (attempt < maxAttempts) {
                            const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
                            reconnectTimeout = setTimeout(() => {
                              connectWithRetry(attempt + 1, maxAttempts);
                            }, backoffDelay);
                          }
                        };
                      } catch (e) {
                        console.error('Error creating alt protocol WebSocket:', e);
                      }
                    }, 1000);
                    
                    return; // Skip regular reconnect logic
                  }
                })
                .catch(e => {
                  console.error('Error checking server status:', e);
                  // Fall through to regular reconnect logic
                });
            }
            
            // Only attempt reconnect if this wasn't a manual close
            if (isConnected && !wasStoppingIntentionally && event.code !== 1000 && event.code !== 4000) {
              isConnected = false;
              
              if (attempt < maxAttempts) {
                const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
                console.log(`Connection closed unexpectedly. Will attempt to reconnect in ${backoffDelay}ms...`);
                
                reconnectTimeout = setTimeout(() => {
                  connectWithRetry(attempt + 1, maxAttempts);
                }, backoffDelay);
              } else {
                console.error('Max reconnection attempts reached after close');
                setStreamingError('Connection closed and could not be re-established.');
                stopStreaming();
              }
            }
          };
          
          // Store reconnect timeout for cleanup
          streamConnectionTimeout.current = reconnectTimeout;
          
        } catch (socketError) {
          console.error('Error creating WebSocket connection:', socketError);
          setStreamingError(`Failed to create connection: ${socketError.message}`);
          setIsLoading(false);
          
          if (attempt < maxAttempts) {
            const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
            streamConnectionTimeout.current = setTimeout(() => {
              connectWithRetry(attempt + 1, maxAttempts);
            }, backoffDelay);
          }
        }
      } catch (error) {
        console.error('Error in connect retry logic:', error);
        setStreamingError('Connection failed due to an unexpected error');
        setIsLoading(false);
        
        if (attempt < maxAttempts) {
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
          streamConnectionTimeout.current = setTimeout(() => {
            connectWithRetry(attempt + 1, maxAttempts);
          }, backoffDelay);
        }
      }
    };
    
    // Start connection process
    connectWithRetry();
  };

    // Function declaration removed to fix duplicate

    /**
   * Visualize audio levels
   */
  const visualize = (analyser) => {
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateLevel = () => {
      if (!analyser) return;

      analyser.getByteFrequencyData(dataArray);

      // Calculate average level
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }

      const average = sum / bufferLength;
      const level = Math.round((average / 255) * 100);

      setAudioInputLevel(level);
      setMeterLevel(level);

      // Continue the visualization loop
      if (isBroadcasting || isPreviewingAudio) {
        requestAnimationFrame(updateLevel);
      }
    };

    updateLevel();
  };

  // When broadcasting state changes, start/stop audio level updates
  useEffect(() => {
    let statusInterval;

    if (isBroadcasting) {
      // Set up WebSocket connection to receive status updates
      const stompClient = streamService.subscribeToStreamStatus((status) => {
        if (status) {
          setMeterLevel(status.audioLevel || 0);
          setAnalytics(prev => ({
            ...prev,
            viewerCount: status.listenerCount || 0
          }));
        }
      });

      // Poll audio status every 3 seconds
      statusInterval = setInterval(async () => {
        try {
          const response = await streamService.getStatus();
          const status = response.data;

          if (status.streaming) {
            setIsStreaming(true);
          } else if (isBroadcasting) {
            // If the server says we're not streaming but we think we are, try to reconnect
            if (websocketRef.current?.readyState !== WebSocket.OPEN) {
              const streamResponse = await streamService.start();
              const wsUrl = streamResponse.data?.streamUrl || streamService.getStreamUrl();
              startStreaming(wsUrl);
            }
          }
        } catch (error) {
          console.error('Error updating stream status:', error);
        }
      }, 3000);

      return () => {
        clearInterval(statusInterval);
        if (stompClient) {
          stompClient.disconnect();
        }
      };
    }

    return () => {
      if (statusInterval) {
        clearInterval(statusInterval);
      }
    };
  }, [isBroadcasting]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, []);

  /**
   * Initialize audio devices list
   */
  useEffect(() => {
    async function loadAudioDevices() {
      try {
        const devices = await getAudioInputDevices();
        setAvailableAudioDevices(devices);
      } catch (error) {
        console.error('Error getting audio devices:', error);
        setToast({
          visible: true,
          message: 'Could not access audio devices: ' + error.message,
          type: 'error'
        });
      }
    }

    loadAudioDevices();
  }, []);

  // Start test broadcast using test mode endpoint
  const startTestBroadcast = async () => {
    try {
      // Find a scheduled broadcast to start, or create a new one
      let broadcastToStart;

      // Look for a scheduled broadcast that hasn't started yet
      if (broadcasts.length > 0) {
        broadcastToStart = broadcasts.find(b => b.status === 'SCHEDULED');
      }

      let broadcastId;
      if (broadcastToStart) {
        // Start an existing scheduled broadcast in test mode
        const response = await broadcastService.startTest(broadcastToStart.id);
        broadcastId = broadcastToStart.id;
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
        broadcastId = createdBroadcast.id;
      }

      setCurrentBroadcastId(broadcastId);
      setIsBroadcasting(true);
      setTestMode(true);

      // Authorize stream start via API - use test mode
      try {
        await streamService.start();
        console.log('Test stream authorized');
      } catch (error) {
        console.error('Error authorizing test stream:', error);
        setToast({
          visible: true,
          message: 'Test stream authorization failed. Check permissions.',
          type: 'error'
        });

        // Revert the broadcast state
        try {
          await broadcastService.end(broadcastId);
        } catch (endError) {
          console.error('Error ending test broadcast after failed authorization:', endError);
        }

        setIsBroadcasting(false);
        setCurrentBroadcastId(null);
        return;
      }

      // Start audio capture if not already previewing
      if (!audioStream) {
        try {
          const constraints = {
            audio: {
              deviceId: audioInputDevice !== 'default' ? { exact: audioInputDevice } : undefined,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          };

          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          setAudioStream(stream);
        } catch (error) {
          console.error('Error accessing microphone:', error);
          setToast({
            visible: true,
            message: `Could not access microphone: ${error.message}`,
            type: 'error'
          });

          // Revert the broadcast state
          try {
            await broadcastService.end(broadcastId);
          } catch (endError) {
            console.error('Error ending test broadcast after failed microphone access:', endError);
          }

          setIsBroadcasting(false);
          setCurrentBroadcastId(null);
          return;
        }
      }

      // Connect to WebSocket and start streaming
      await connectWebSocket();

      console.log('Starting TEST broadcast');
      console.log('Using audio device:', audioInputDevice);

      // Show status message
      setToast({
        visible: true,
        message: 'Test broadcast started. Audio is being streamed.',
        type: 'success'
      });
    } catch (error) {
      console.error('Error starting test broadcast:', error);
      setToast({
        visible: true,
        message: 'There was an error starting the test broadcast: ' + error.message,
        type: 'error'
      });
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
      setIsLoading(true);

      if (serverRunning) {
        // Stop the server
        await serverService.stopNow();
        setServerRunning(false);
        console.log('Stopping server');
        setStatusModal({
          isOpen: true,
          message: 'Server stopped successfully',
          type: 'success'
        });
      } else {
        // Start the server
        await serverService.startNow();
        setServerRunning(true);
        console.log('Starting server');
        setStatusModal({
          isOpen: true,
          message: 'Server started successfully',
          type: 'success'
        });
      }
    } catch (error) {
      console.error('Error toggling server:', error);
      setStatusModal({
        isOpen: true,
        message: 'There was an error controlling the server. Please try again.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
  };

  // Handle server schedule submission
  const handleServerScheduleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Validate the form
      if (!newSchedule.scheduledStart || !newSchedule.scheduledEnd) {
        showToast('Please enter both start and end times', 'error');
        return;
      }

      // Validate that end time is after start time
      if (newSchedule.scheduledStart >= newSchedule.scheduledEnd) {
        showToast('End time must be after start time', 'error');
        return;
      }

      // If scheduling for today, validate times are not in the past
      const now = new Date();
      const today = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysOfWeek = { 'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3, 'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6 };
      const selectedDayNum = daysOfWeek[newSchedule.dayOfWeek];

      if (selectedDayNum === today) {
        const [startHours, startMinutes] = newSchedule.scheduledStart.split(':').map(Number);
        const scheduleStartTime = new Date();
        scheduleStartTime.setHours(startHours, startMinutes, 0, 0);

        if (scheduleStartTime < now) {
          showToast('Cannot schedule a broadcast in the past', 'error');
          return;
        }
      }

      setIsLoading(true);

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
        setScheduleStatusModal({
          isOpen: true,
          message: 'Server schedule updated successfully!',
          type: 'success'
        });
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
        setScheduleStatusModal({
          isOpen: true,
          message: 'Server schedule created successfully!',
          type: 'success'
        });
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
      setScheduleStatusModal({
        isOpen: true,
        message: 'There was an error saving the schedule. Please try again.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle schedule deletion
  const confirmDeleteSchedule = (schedule) => {
    setScheduleToDelete(schedule);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteSchedule = async () => {
    if (!scheduleToDelete) return;

    try {
      setIsLoading(true);

      // Call the API to delete the schedule
      await serverService.deleteSchedule(scheduleToDelete.id);

      // Remove the schedule from the local state
      setServerSchedules(serverSchedules.filter(s => s.id !== scheduleToDelete.id));

      // Close the confirmation modal
      setIsDeleteConfirmOpen(false);
      setScheduleToDelete(null);

      // Show success message
      setScheduleStatusModal({
        isOpen: true,
        message: 'Schedule deleted successfully!',
        type: 'success'
      });
    } catch (error) {
      console.error("Error deleting schedule:", error);

      // Show a more detailed error message based on the status code
      let errorMessage = 'Failed to delete schedule. Please try again.';
      if (error.response) {
        if (error.response.status === 405) {
          errorMessage = 'Server does not support schedule deletion. Please contact your administrator.';
        } else if (error.response.status === 403) {
          errorMessage = 'You do not have permission to delete this schedule.';
        } else if (error.response.data && error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      }

      setScheduleStatusModal({
        isOpen: true,
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
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

  // Handle schedule editing
  const handleEditSchedule = (schedule) => {
    // Format times from schedule to match time input format (HH:MM)
    const formatTime = (timeString) => {
      if (!timeString) return '';
      // If it's already in HH:MM format, return as is
      if (timeString.match(/^\d{2}:\d{2}$/)) return timeString;

      try {
        // If it's a date object or date string, format it
        const date = new Date(timeString);
        if (isNaN(date.getTime())) return '';
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      } catch (e) {
        console.error('Error formatting time:', e);
        return '';
      }
    };

    setSelectedDay(schedule.dayOfWeek);
    setNewSchedule({
      dayOfWeek: schedule.dayOfWeek,
      scheduledStart: formatTime(schedule.scheduledStart),
      scheduledEnd: formatTime(schedule.scheduledEnd),
      automatic: schedule.automatic
    });
    setScheduleFormModal({ isOpen: true, isEdit: true });
  };

  // Handle opening the add schedule modal
  const handleAddSchedule = (day) => {
    setSelectedDay(day);
    setNewSchedule({
      dayOfWeek: day,
      scheduledStart: '',
      scheduledEnd: '',
      automatic: true
    });
    setScheduleFormModal({ isOpen: true, isEdit: false });
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Toast Notifications */}
      {toast.visible && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast({ ...toast, visible: false })} 
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeleteSchedule}
        title="Delete Schedule"
        message={`Are you sure you want to delete the schedule for ${scheduleToDelete?.dayOfWeek.charAt(0) + scheduleToDelete?.dayOfWeek.slice(1).toLowerCase()}?`}
        confirmText="Delete"
        confirmButtonType="danger"
        isLoading={isLoading}
      />

      {/* Server Status Modal */}
      <Modal
        isOpen={statusModal.isOpen}
        onClose={() => setStatusModal({ ...statusModal, isOpen: false })}
        title={statusModal.type === 'success' ? 'Success' : 'Error'}
        type={statusModal.type}
        maxWidth="sm"
      >
        <p>{statusModal.message}</p>
      </Modal>

      {/* Schedule Status Modal */}
      <Modal
        isOpen={scheduleStatusModal.isOpen}
        onClose={() => setScheduleStatusModal({ ...scheduleStatusModal, isOpen: false })}
        title={scheduleStatusModal.type === 'success' ? 'Success' : 'Error'}
        type={scheduleStatusModal.type}
        maxWidth="sm"
      >
        <p>{scheduleStatusModal.message}</p>
      </Modal>

      {/* Schedule Form Modal */}
      <Modal
        isOpen={scheduleFormModal.isOpen}
        onClose={() => setScheduleFormModal({ ...scheduleFormModal, isOpen: false })}
        title={`${scheduleFormModal.isEdit ? 'Edit' : 'Add'} Schedule for ${selectedDay.charAt(0) + selectedDay.slice(1).toLowerCase()}`}
        maxWidth="md"
      >
        <form onSubmit={(e) => {
          handleServerScheduleSubmit(e); 
          setScheduleFormModal({ ...scheduleFormModal, isOpen: false });
        }}>
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

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setScheduleFormModal({ ...scheduleFormModal, isOpen: false })}
              className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-maroon-700 hover:bg-maroon-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-600"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                <>
                  <ClockIcon className="h-5 w-5 mr-1" />
                  {scheduleFormModal.isEdit ? 'Update' : 'Add'} Schedule
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

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
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="audioDevice" className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Audio Input Device
                    </label>
                    <div className="flex space-x-2">
                      <button 
                        type="button" 
                        className="flex items-center text-sm px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
                        onClick={getAudioDevices}
                        disabled={isBroadcasting}
                        title="Refresh device list"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-arrow-clockwise mr-1" viewBox="0 0 16 16">
                          <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                          <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                        </svg>
                        Refresh
                      </button>

                      {availableAudioDevices.length > 0 && !isBroadcasting && !testMode && (
                        <button 
                          type="button" 
                          className={`flex items-center text-sm px-2 py-1 rounded ${
                            isPreviewingAudio 
                              ? 'bg-maroon-100 text-maroon-800 hover:bg-maroon-200 dark:bg-maroon-900 dark:text-maroon-200 dark:hover:bg-maroon-800' 
                              : 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800'
                          } transition-colors`}
                          onClick={toggleAudioPreview}
                          disabled={!availableAudioDevices.length}
                          title={isPreviewingAudio ? "Stop audio preview" : "Preview microphone levels"}
                        >
                          {isPreviewingAudio ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                              </svg>
                              Stop Preview
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                              </svg>
                              Preview
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <select
                      id="audioDevice"
                      className="block w-full rounded-md border-gray-300 bg-white dark:bg-gray-700 pl-3 pr-10 py-2 text-base focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 dark:border-gray-600 dark:text-white shadow-sm disabled:opacity-70 disabled:cursor-not-allowed appearance-none"
                      value={audioInputDevice}
                      onChange={handleAudioDeviceChange}
                      disabled={isBroadcasting}
                    >
                      {availableAudioDevices.length > 0 ? (
                        availableAudioDevices.map((device, index) => (
                          <option key={`device-${index}-${device.deviceId || device.id}`} value={device.id}>
                            {device.label}
                          </option>
                        ))
                      ) : (
                        <option key="no-devices-fallback" value="default">No devices detected</option>
                      )}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>

                  {availableAudioDevices.length === 0 && (
                    <div className="flex items-center mt-2 p-3 rounded-md bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm">
                        No audio devices detected. Please check your microphone permissions and connections, then click refresh.
                      </span>
                    </div>
                  )}

                  {availableAudioDevices.length > 0 && !isBroadcasting && !testMode && (
                    <div className="flex items-center mt-2 p-3 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm">
                        Click "Test Audio" to verify your microphone is working properly before broadcasting.
                      </span>
                    </div>
                  )}
                </div>

                {/* Audio Level Meter - show when previewing, broadcasting or in test mode */}
                {(isBroadcasting || testMode || isPreviewingAudio) && (
                  <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Audio Input Level
                      </label>
                      {isPreviewingAudio && (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          Preview Mode
                        </span>
                      )}
                      {isBroadcasting && !isPreviewingAudio && (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          Live
                        </span>
                      )}
                      {testMode && !isPreviewingAudio && !isBroadcasting && (
                        <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          Test Mode
                        </span>
                      )}
                    </div>

                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className={`h-full transition-all duration-150 ${
                          audioInputLevel > 80 
                            ? 'bg-gradient-to-r from-red-500 to-red-600' 
                            : audioInputLevel > 60 
                              ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' 
                              : 'bg-gradient-to-r from-green-400 to-green-500'
                        }`}
                        style={{ width: `${audioInputLevel}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                      <div className="flex items-center">
                        <span className="h-2 w-2 bg-green-500 rounded-full mr-1"></span>
                        <span>Low</span>
                      </div>
                      <div className="flex items-center">
                        <span className="h-2 w-2 bg-yellow-500 rounded-full mr-1"></span>
                        <span>Medium</span>
                      </div>
                      <div className="flex items-center">
                        <span className="h-2 w-2 bg-red-500 rounded-full mr-1"></span>
                        <span>High ({audioInputLevel}%)</span>
                      </div>
                    </div>

                    {isPreviewingAudio && (
                      <div className="mt-3 text-sm bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded text-yellow-800 dark:text-yellow-200 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        If you experience audio feedback, try using headphones or lower your speaker volume.
                      </div>
                    )}

                    <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Device in use: </span>
                      {availableAudioDevices.find(d => d.id === audioInputDevice)?.label || 'Default device'}
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

          {/* Song Requests */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
                Song Requests
              </h2>

              <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-maroon-500 dark:scrollbar-thumb-maroon-700 scrollbar-track-gray-200 dark:scrollbar-track-gray-700">
                {songRequests.length > 0 ? (
                  <ul className="space-y-3">
                    {songRequests.map((request) => (
                      <li key={request.id} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                        <div className="flex justify-between">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {request.songTitle} {request.artist && <span>by {request.artist}</span>}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {request.timestamp ? new Date(request.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                          </p>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Requested by: {request.requestedBy ? request.requestedBy.name : 'Unknown'}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">No song requests yet</p>
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

              {/* Server Status */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
                    Broadcast Details
                  </h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-700 dark:text-gray-300 mb-1">Status</p>
                      <div className="flex items-center">
                        <span className={`h-3 w-3 rounded-full mr-2 ${isBroadcasting ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {isBroadcasting ? 'Broadcasting' : 'Not Broadcasting'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-700 dark:text-gray-300 mb-1">Shoutcast Status</p>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {isBroadcasting ? 'Connected' : 'Ready to connect'}
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-700 dark:text-gray-300 mb-1">Streaming Quality</p>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        128 kbps MP3
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Manual Server Control - NEW SECTION */}
              <div className="mb-6 mt-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Manual Server Control</h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Server Status</p>
                      <div className="flex items-center">
                        <span className={`h-3 w-3 rounded-full mr-2 ${serverRunning ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {serverRunning ? 'Running' : 'Stopped'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={toggleServer}
                      disabled={isLoading}
                      className={`px-4 py-2 rounded-md font-medium text-sm ${
                        serverRunning
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      } focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        serverRunning ? 'focus:ring-red-500' : 'focus:ring-green-500'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isLoading ? (
                        <span>Processing...</span>
                      ) : serverRunning ? (
                        <span>Stop Server</span>
                      ) : (
                        <span>Start Server</span>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    This will start or stop the Shoutcast server immediately without creating a schedule.
                  </p>
                </div>
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
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {daySchedule.scheduledStart} - {daySchedule.scheduledEnd}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500 dark:text-gray-500 italic">No schedule</div>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              {daySchedule ? (
                                <>
                                  <button
                                    onClick={() => handleEditSchedule(daySchedule)}
                                    className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                    title="Edit schedule"
                                  >
                                    <PencilIcon className="h-5 w-5" />
                                  </button>
                                  <button
                                    onClick={() => confirmDeleteSchedule(daySchedule)}
                                    className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                    title="Delete schedule"
                                  >
                                    <TrashIcon className="h-5 w-5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleAddSchedule(day)}
                                  className="p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                                  title="Add schedule"
                                >
                                  <PlusCircleIcon className="h-5 w-5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-500 dark:text-gray-400 mb-4">No schedules configured</p>
                      <button
                        onClick={() => handleAddSchedule('MONDAY')}
                        className="inline-flex items-center px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-md"
                      >
                        <PlusCircleIcon className="h-5 w-5 mr-2" />
                        Add Schedule
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
