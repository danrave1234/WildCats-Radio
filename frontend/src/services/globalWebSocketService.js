
import { createLogger } from './logger';

const logger = createLogger('GlobalWebSocketService');

class GlobalWebSocketService {
  constructor() {
    this.djWebSocket = null;
    this.listenerStatusWebSocket = null; // Consolidated listener and status
    this.djReconnectAttempts = 0;
    this.listenerStatusReconnectAttempts = 0;
    this.MAX_RECONNECT_ATTEMPTS = 15; // Increased for DJ reliability
    this.DJ_MAX_RECONNECT_ATTEMPTS = 20; // More aggressive for DJ websocket
    this.BASE_RECONNECT_DELAY = 1000; // 1 second
    this.djPingInterval = null;
    this.listenerStatusPingInterval = null;

    // Reconnection timer references
    this.djReconnectTimer = null;
    this.listenerStatusReconnectTimer = null;
    this.pollReconnectTimer = null;

    // Connection health monitoring
    this.djLastPongTime = null;
    this.djConnectionHealthTimer = null;
    this.networkStatusOnline = navigator.onLine;

    // Connection state persistence
    this.lastDJUrl = null;
    this.lastListenerStatusUrl = null;

    // Setup network status monitoring
    this._setupNetworkMonitoring();

    // Callbacks for different WebSocket types
    this.djMessageCallbacks = [];
    this.listenerStatusMessageCallbacks = [];
    this.djErrorCallbacks = [];
    this.listenerStatusErrorCallbacks = [];
    this.djCloseCallbacks = [];
    this.listenerStatusCloseCallbacks = [];
    this.djOpenCallbacks = [];
    this.listenerStatusOpenCallbacks = [];
    this.pollMessageCallbacks = [];
    this.pollErrorCallbacks = [];
    this.pollCloseCallbacks = [];
    this.pollOpenCallbacks = [];
  }

  // --- Network Status Monitoring ---
  _setupNetworkMonitoring() {
    window.addEventListener('online', () => {
      logger.info('Network came back online, attempting to reconnect websockets');
      this.networkStatusOnline = true;
      this._handleNetworkReconnection();
    });

    window.addEventListener('offline', () => {
      logger.warn('Network went offline, websockets will attempt to reconnect when online');
      this.networkStatusOnline = false;
    });
  }

  _handleNetworkReconnection() {
    // Reset reconnection attempts when network comes back online
    this.djReconnectAttempts = 0;
    this.listenerStatusReconnectAttempts = 0;

    // Attempt to reconnect if we have stored URLs and connections are down
    if (this.lastDJUrl && !this.isDJWebSocketConnected()) {
      logger.info('Attempting DJ WebSocket reconnection after network recovery');
      this.connectDJWebSocket(this.lastDJUrl);
    }

    if (this.lastListenerStatusUrl && !this.isListenerStatusWebSocketConnected()) {
      logger.info('Attempting Listener/Status WebSocket reconnection after network recovery');
      this.connectListenerStatusWebSocket(this.lastListenerStatusUrl);
    }
  }

  // --- Helper for Reconnection Logic ---
  _scheduleReconnect(type, connectFunction, attemptsProperty, timerProperty) {
    // Use different max attempts for DJ websocket (more critical)
    const maxAttempts = type === 'DJ' ? this.DJ_MAX_RECONNECT_ATTEMPTS : this.MAX_RECONNECT_ATTEMPTS;

    if (this[attemptsProperty] < maxAttempts) {
      this[attemptsProperty]++;

      // Don't attempt reconnection if network is offline
      if (!this.networkStatusOnline) {
        logger.warn(`Network is offline, delaying ${type} WebSocket reconnection attempt ${this[attemptsProperty]}/${maxAttempts}`);
        this[timerProperty] = setTimeout(() => {
          this._scheduleReconnect(type, connectFunction, attemptsProperty, timerProperty);
        }, 5000); // Check again in 5 seconds
        return;
      }

      const delay = Math.min(this.BASE_RECONNECT_DELAY * Math.pow(2, this[attemptsProperty] - 1) + Math.floor(Math.random() * 1000), 30000); // Max 30s
      logger.warn(`Scheduling ${type} WebSocket reconnection attempt ${this[attemptsProperty]}/${maxAttempts} in ${delay}ms`);
      this[timerProperty] = setTimeout(() => {
        connectFunction();
      }, delay);
    } else {
      logger.error(`Max ${type} WebSocket reconnection attempts (${maxAttempts}) reached, giving up.`);
      // Optionally, notify UI or trigger a more severe error state
    }
  }

  _clearReconnectTimer(timerProperty) {
    if (this[timerProperty]) {
      clearTimeout(this[timerProperty]);
      this[timerProperty] = null;
    }
  }

  // --- DJ WebSocket (Audio Streaming) ---
  connectDJWebSocket(wsUrl) {
    if (this.djWebSocket && (this.djWebSocket.readyState === WebSocket.CONNECTING || this.djWebSocket.readyState === WebSocket.OPEN)) {
      logger.debug('DJ WebSocket already connected or connecting.');
      return;
    }

    this._clearReconnectTimer('djReconnectTimer'); // Clear any pending reconnect
    this.lastDJUrl = wsUrl; // Store URL for persistence

    logger.info(`Connecting DJ WebSocket to: ${wsUrl}`);
    try {
      this.djWebSocket = new WebSocket(wsUrl);
      this.djWebSocket.binaryType = "arraybuffer";

      this.djWebSocket.onopen = () => {
        logger.info('DJ WebSocket connected successfully.');
        this.djReconnectAttempts = 0; // Reset attempts on success
        this.djLastPongTime = Date.now(); // Initialize pong time
        this.djOpenCallbacks.forEach(cb => cb());
        this._startDJPing();
        this._startDJConnectionHealthMonitoring();
      };

      this.djWebSocket.onmessage = (event) => {
        if (typeof event.data === 'string' && event.data === 'pong') {
          // Handle pong response and update health monitoring
          this.djLastPongTime = Date.now();
          logger.debug('Received DJ pong, connection healthy.');
        } else {
          this.djMessageCallbacks.forEach(cb => cb(event));
        }
      };

      this.djWebSocket.onerror = (event) => {
        logger.error('DJ WebSocket error:', event);
        this.djErrorCallbacks.forEach(cb => cb(event));
      };

      this.djWebSocket.onclose = (event) => {
        logger.warn(`DJ WebSocket disconnected: Code=${event.code}, Reason=${event.reason}`);
        this.djCloseCallbacks.forEach(cb => cb(event));
        this._stopDJPing();
        this._stopDJConnectionHealthMonitoring();
        // Only attempt reconnect if not a clean close (1000, 1001)
        if (event.code !== 1000 && event.code !== 1001) {
          this._scheduleReconnect('DJ', () => this.connectDJWebSocket(wsUrl), 'djReconnectAttempts', 'djReconnectTimer');
        }
      };
    } catch (error) {
      logger.error('Error creating DJ WebSocket:', error);
      this.djErrorCallbacks.forEach(cb => cb(error));
      this._scheduleReconnect('DJ', () => this.connectDJWebSocket(wsUrl), 'djReconnectAttempts', 'djReconnectTimer');
    }
  }

  sendDJMessage(message) {
    if (this.djWebSocket && this.djWebSocket.readyState === WebSocket.OPEN) {
      this.djWebSocket.send(message);
    } else {
      logger.warn('DJ WebSocket not open, cannot send message.');
    }
  }

  sendDJBinaryData(buffer) {
    if (this.djWebSocket && this.djWebSocket.readyState === WebSocket.OPEN) {
      this.djWebSocket.send(buffer);
      return true;
    } else {
      logger.warn('DJ WebSocket not open, cannot send binary data.');
      return false;
    }
  }

  disconnectDJWebSocket() {
    if (this.djWebSocket) {
      logger.info('Disconnecting DJ WebSocket.');
      this._clearReconnectTimer('djReconnectTimer');
      this._stopDJPing();
      this._stopDJConnectionHealthMonitoring();
      this.djWebSocket.close(1000, 'Client initiated disconnect');
      this.djWebSocket = null;
      this.lastDJUrl = null; // Clear stored URL
    }
  }

  onDJMessage(callback) { this.djMessageCallbacks.push(callback); }
  onDJError(callback) { this.djErrorCallbacks.push(callback); }
  onDJClose(callback) { this.djCloseCallbacks.push(callback); }
  onDJOpen(callback) { this.djOpenCallbacks.push(callback); }

  _startDJPing() {
    this._stopDJPing(); // Ensure no duplicate pings
    this.djPingInterval = setInterval(() => {
      if (this.djWebSocket && this.djWebSocket.readyState === WebSocket.OPEN) {
        this.djWebSocket.send('ping');
        logger.debug('Sent DJ ping.');
      }
    }, 30000); // Ping every 30 seconds
  }

  _stopDJPing() {
    if (this.djPingInterval) {
      clearInterval(this.djPingInterval);
      this.djPingInterval = null;
    }
  }

  _startDJConnectionHealthMonitoring() {
    this._stopDJConnectionHealthMonitoring(); // Ensure no duplicates
    this.djConnectionHealthTimer = setInterval(() => {
      if (this.djLastPongTime) {
        const timeSinceLastPong = Date.now() - this.djLastPongTime;
        const healthThreshold = 60000; // 60 seconds without pong = unhealthy

        if (timeSinceLastPong > healthThreshold) {
          logger.warn(`DJ WebSocket appears unhealthy (no pong for ${timeSinceLastPong}ms), forcing reconnection`);
          if (this.djWebSocket) {
            this.djWebSocket.close(1006, 'Connection health check failed');
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  _stopDJConnectionHealthMonitoring() {
    if (this.djConnectionHealthTimer) {
      clearInterval(this.djConnectionHealthTimer);
      this.djConnectionHealthTimer = null;
    }
  }

  _startListenerStatusPing() {
    this._stopListenerStatusPing();
    this.listenerStatusPingInterval = setInterval(() => {
      if (this.listenerStatusWebSocket && this.listenerStatusWebSocket.readyState === WebSocket.OPEN) {
        this.listenerStatusWebSocket.send('ping');
        logger.debug('Sent listener/status ping.');
      }
    }, 60000); // Ping every minute
  }

  _stopListenerStatusPing() {
    if (this.listenerStatusPingInterval) {
      clearInterval(this.listenerStatusPingInterval);
      this.listenerStatusPingInterval = null;
    }
  }

  // --- Listener/Status WebSocket (Consolidated) ---
  connectListenerStatusWebSocket(wsUrl) {
    if (this.listenerStatusWebSocket && (this.listenerStatusWebSocket.readyState === WebSocket.CONNECTING || this.listenerStatusWebSocket.readyState === WebSocket.OPEN)) {
      logger.debug('Listener/Status WebSocket already connected or connecting.');
      return;
    }

    this._clearReconnectTimer('listenerStatusReconnectTimer'); // Clear any pending reconnect
    this.lastListenerStatusUrl = wsUrl; // Store URL for persistence

    logger.info(`Connecting Listener/Status WebSocket to: ${wsUrl}`);
    try {
      this.listenerStatusWebSocket = new WebSocket(wsUrl);

      this.listenerStatusWebSocket.onopen = () => {
        logger.info('Listener/Status WebSocket connected successfully.');
        this.listenerStatusReconnectAttempts = 0; // Reset attempts on success
        this.listenerStatusOpenCallbacks.forEach(cb => cb());
        this._startListenerStatusPing();
      };

      this.listenerStatusWebSocket.onmessage = (event) => {
        this.listenerStatusMessageCallbacks.forEach(cb => cb(event));
      };

      this.listenerStatusWebSocket.onerror = (event) => {
        logger.error('Listener/Status WebSocket error:', event);
        this.listenerStatusErrorCallbacks.forEach(cb => cb(event));
      };

      this.listenerStatusWebSocket.onclose = (event) => {
        logger.warn(`Listener/Status WebSocket disconnected: Code=${event.code}, Reason=${event.reason}`);
        this.listenerStatusCloseCallbacks.forEach(cb => cb(event));
        this._stopListenerStatusPing();
        if (event.code !== 1000 && event.code !== 1001) {
          this._scheduleReconnect('Listener/Status', () => this.connectListenerStatusWebSocket(wsUrl), 'listenerStatusReconnectAttempts', 'listenerStatusReconnectTimer');
        }
      };
    } catch (error) {
      logger.error('Error creating Listener/Status WebSocket:', error);
      this.listenerStatusErrorCallbacks.forEach(cb => cb(error));
      this._scheduleReconnect('Listener/Status', () => this.connectListenerStatusWebSocket(wsUrl), 'listenerStatusReconnectAttempts', 'listenerStatusReconnectTimer');
    }
  }

  sendListenerStatusMessage(message) {
    if (this.listenerStatusWebSocket && this.listenerStatusWebSocket.readyState === WebSocket.OPEN) {
      this.listenerStatusWebSocket.send(message);
    } else {
      logger.warn('Listener/Status WebSocket not open, cannot send message.');
    }
  }

  disconnectListenerStatusWebSocket() {
    if (this.listenerStatusWebSocket) {
      logger.info('Disconnecting Listener/Status WebSocket.');
      this._clearReconnectTimer('listenerStatusReconnectTimer');
      this._stopListenerStatusPing();
      this.listenerStatusWebSocket.close(1000, 'Client initiated disconnect');
      this.listenerStatusWebSocket = null;
      this.lastListenerStatusUrl = null; // Clear stored URL
    }
  }

  onListenerStatusMessage(callback) { this.listenerStatusMessageCallbacks.push(callback); }
  onListenerStatusError(callback) { this.listenerStatusErrorCallbacks.push(callback); }
  onListenerStatusClose(callback) { this.listenerStatusCloseCallbacks.push(callback); }
  onListenerStatusOpen(callback) { this.listenerStatusOpenCallbacks.push(callback); }

  // --- Poll WebSocket ---
  connectPollWebSocket(wsUrl) {
    if (this.pollWebSocket && (this.pollWebSocket.readyState === WebSocket.CONNECTING || this.pollWebSocket.readyState === WebSocket.OPEN)) {
      logger.debug('Poll WebSocket already connected or connecting.');
      return;
    }

    this._clearReconnectTimer('pollReconnectTimer'); // Clear any pending reconnect

    logger.info(`Connecting Poll WebSocket to: ${wsUrl}`);
    try {
      this.pollWebSocket = new WebSocket(wsUrl);

      this.pollWebSocket.onopen = () => {
        logger.info('Poll WebSocket connected successfully.');
        this.pollReconnectAttempts = 0; // Reset attempts on success
        this.pollOpenCallbacks.forEach(cb => cb());
      };

      this.pollWebSocket.onmessage = (event) => {
        this.pollMessageCallbacks.forEach(cb => cb(event));
      };

      this.pollWebSocket.onerror = (event) => {
        logger.error('Poll WebSocket error:', event);
        this.pollErrorCallbacks.forEach(cb => cb(event));
      };

      this.pollWebSocket.onclose = (event) => {
        logger.warn(`Poll WebSocket disconnected: Code=${event.code}, Reason=${event.reason}`);
        this.pollCloseCallbacks.forEach(cb => cb(event));
        if (event.code !== 1000 && event.code !== 1001) {
          this._scheduleReconnect('Poll', () => this.connectPollWebSocket(wsUrl), 'pollReconnectAttempts', 'pollReconnectTimer');
        }
      };
    } catch (error) {
      logger.error('Error creating Poll WebSocket:', error);
      this.pollErrorCallbacks.forEach(cb => cb(error));
      this._scheduleReconnect('Poll', () => this.connectPollWebSocket(wsUrl), 'pollReconnectAttempts', 'pollReconnectTimer');
    }
  }

  sendPollMessage(message) {
    if (this.pollWebSocket && this.pollWebSocket.readyState === WebSocket.OPEN) {
      this.pollWebSocket.send(message);
    } else {
      logger.warn('Poll WebSocket not open, cannot send message.');
    }
  }

  disconnectPollWebSocket() {
    if (this.pollWebSocket) {
      logger.info('Disconnecting Poll WebSocket.');
      this._clearReconnectTimer('pollReconnectTimer');
      this.pollWebSocket.close(1000, 'Client initiated disconnect');
      this.pollWebSocket = null;
    }
  }

  onPollMessage(callback) { this.pollMessageCallbacks.push(callback); }
  onPollError(callback) { this.pollErrorCallbacks.push(callback); }
  onPollClose(callback) { this.pollCloseCallbacks.push(callback); }
  onPollOpen(callback) { this.pollOpenCallbacks.push(callback); }

  // --- Global Disconnect ---
  disconnectAll() {
    this.disconnectDJWebSocket();
    this.disconnectListenerStatusWebSocket();
    this.disconnectPollWebSocket();
    logger.info('All WebSockets disconnected.');
  }

  // --- Getters for WebSocket state ---
  isDJWebSocketConnected() {
    return this.djWebSocket && this.djWebSocket.readyState === WebSocket.OPEN;
  }

  isListenerStatusWebSocketConnected() {
    return this.listenerStatusWebSocket && this.listenerStatusWebSocket.readyState === WebSocket.OPEN;
  }

  getDJWebSocket() {
    return this.djWebSocket;
  }
}

export const globalWebSocketService = new GlobalWebSocketService();
