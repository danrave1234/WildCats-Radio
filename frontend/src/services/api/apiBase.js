import axios from 'axios';
import { handleSecuritySoftwareErrors } from '../errorHandler';
// WebSocket support libraries
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { config, configUtils } from '../../config';
import { createLogger } from '../logger';

const logger = createLogger('APIService');

/**
 * Enhanced API Proxy Base System
 * Provides centralized API configuration and automatic environment detection
 */
class ApiProxyBase {
  constructor() {
    this.config = config;
    this.logger = logger;
    this.axiosInstance = null;
    this.initialize();
  }

  /**
   * Initialize the API proxy with current configuration
   */
  initialize() {
    this.logEnvironmentInfo();
    this.axiosInstance = this.createAxiosInstance();
    this.setupInterceptors();
  }

  /**
   * Log current environment and configuration info
   */
  logEnvironmentInfo() {
    this.logger.info('🚀 API Proxy Base Initialized');
    this.logger.info(`Environment: ${this.config.environment.toUpperCase()}`);
    this.logger.info(`API Base URL: ${this.config.apiBaseUrl}`);
    this.logger.info(`WebSocket Base URL: ${this.config.wsBaseUrl}`);
    this.logger.info(`SockJS Base URL: ${this.config.sockJsBaseUrl}`);
    this.logger.info(`Debug Logs: ${this.config.enableDebugLogs ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Create enhanced axios instance with retry logic
   */
  createAxiosInstance() {
    const instance = axios.create({
      baseURL: this.config.apiBaseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: this.config.apiTimeout,
      withCredentials: true,
    });

    // Add retry logic for failed requests
    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Don't retry if we've already retried max times
        if (originalRequest._retryCount >= this.config.maxRetries) {
          return handleSecuritySoftwareErrors(error);
        }

        // Check if we should retry (network errors, timeouts, 5xx errors)
        const shouldRetry = !originalRequest._retryCount && (
          error.code === 'ECONNABORTED' || // timeout
          error.code === 'NETWORK_ERROR' || // network error
          (error.response && error.response.status >= 500) // server error
        );

        if (shouldRetry) {
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;

          // Wait before retrying (with exponential backoff)
          const delay = this.config.retryDelay * Math.pow(2, originalRequest._retryCount - 1);
          this.logger.info(`Retrying request (attempt ${originalRequest._retryCount}/${this.config.maxRetries}) after ${delay}ms`);

          await new Promise(resolve => setTimeout(resolve, delay));
          return instance(originalRequest);
        }

        return handleSecuritySoftwareErrors(error);
      }
    );

    return instance;
  }

  /**
   * Setup request/response interceptors
   */
  setupInterceptors() {
    // Request interceptor for authentication
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = this.getCookie('token');
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }

        // Prevent stale caches and always fetch fresh analytics data
        if (config.method && config.method.toLowerCase() === 'get') {
          config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
          config.headers['Pragma'] = 'no-cache';
          config.headers['Expires'] = '0';
          // Add a cache-busting param while preserving any existing params
          const ts = Date.now();
          if (config.params) {
            config.params = { ...config.params, _ts: ts };
          } else {
            config.params = { _ts: ts };
          }
        }

        // Log request in debug mode
        if (this.config.enableDebugLogs) {
          this.logger.debug(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        if (this.config.enableDebugLogs) {
          this.logger.debug(`✅ API Response: ${response.status} ${response.config.url}`);
        }
        return response;
      },
      (error) => {
        if (this.config.enableDebugLogs) {
          this.logger.error(`❌ API Error: ${error.response?.status || 'Network'} ${error.config?.url}`);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get cookie value
   */
  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
  }

  /**
   * Get the axios instance
   */
  getAxiosInstance() {
    return this.axiosInstance;
  }

  /**
   * Create WebSocket connection with enhanced configuration
   */
  createWebSocketConnection(endpoint) {
    const sockJsUrl = configUtils.getSockJsUrl(endpoint);

    // Use factory function for proper auto-reconnect support
    const stompClient = Stomp.over(() => new SockJS(sockJsUrl));

    // Enhanced reconnection settings
    stompClient.reconnect_delay = this.config.wsReconnectDelay;
    stompClient.heartbeat.outgoing = this.config.wsHeartbeatInterval;
    stompClient.heartbeat.incoming = this.config.wsHeartbeatInterval;
    stompClient.maxConnectAttempts = this.config.wsMaxReconnectAttempts;

    // Add debug logging
    stompClient.debug = (str) => {
      if (str.includes('ERROR') || str.includes('DISCONNECT') || str.includes('CONNECT')) {
        this.logger.warn('STOMP Important:', str);
      } else if (this.config.enableVerboseLogs) {
        this.logger.debug('STOMP Debug:', str);
      }
    };

    // Add connection state tracking
    stompClient.onWebSocketError = (error) => {
      this.logger.error('WebSocket error:', error);
    };

    stompClient.onWebSocketClose = (event) => {
      this.logger.warn('WebSocket closed:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
    };

    return stompClient;
  }

  /**
   * Get full API URL for an endpoint
   */
  getApiUrl(endpoint) {
    return configUtils.getApiUrl(endpoint);
  }

  /**
   * Get WebSocket URL for an endpoint
   */
  getWsUrl(endpoint) {
    return configUtils.getWsUrl(endpoint);
  }

  /**
   * Get SockJS URL for an endpoint
   */
  getSockJsUrl(endpoint) {
    return configUtils.getSockJsUrl(endpoint);
  }
}

// Create singleton instance of API proxy
const apiProxy = new ApiProxyBase();

// Export the axios instance for backward compatibility
const api = apiProxy.getAxiosInstance();

// Legacy function for backward compatibility
const constructUrl = (configKey, fallbackPath = '') => {
  logger.debug('Using legacy constructUrl - consider migrating to configUtils');

  let baseUrl;
  if (configKey === 'apiBaseUrl') {
    baseUrl = config.apiBaseUrl;
  } else if (configKey === 'wsBaseUrl') {
    baseUrl = config.wsBaseUrl;
  } else if (configKey === 'sockJsBaseUrl') {
    baseUrl = config.sockJsBaseUrl;
  } else if (configKey === 'icecastUrl') {
    baseUrl = config.icecastUrl;
  } else {
    throw new Error(`Unknown config key: ${configKey}`);
  }

  return baseUrl + fallbackPath;
};

// Cookie helper function for backward compatibility
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
};

// Enhanced WebSocket connection function with better error handling for cloud backend
const createWebSocketConnection = (endpoint) => {
  return apiProxy.createWebSocketConnection(endpoint);
};

export { 
  apiProxy, 
  api, 
  constructUrl, 
  getCookie, 
  createWebSocketConnection,
  logger 
};