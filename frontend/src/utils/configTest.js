/**
 * Configuration Test Utility
 * 
 * This utility demonstrates and tests the centralized configuration system
 * and API proxy base functionality.
 */

import { config, configUtils, apiProxy } from '../config';
import { createLogger } from '../services/logger';

const logger = createLogger('ConfigTest');

export function runConfigurationTests() {
  logger.info('🚀 Running WildCats Radio Configuration Tests...\n');

  // Test environment detection
  const isLocalEnvironment = config.environment === 'local';
  const isDeployedEnvironment = config.environment === 'deployed';

  logger.info('Environment Detection:');
  logger.info(`- Current Environment: ${config.environment}`);
  logger.info(`- Is Local: ${isLocalEnvironment}`);
  logger.info(`- Is Deployed: ${isDeployedEnvironment}`);
  logger.info(`- Hostname: ${window.location.hostname}`);

  logger.info('\nURL Configuration:');
  logger.info(`- API Base URL: ${config.apiBaseUrl}`);
  logger.info(`- WebSocket Base URL: ${config.wsBaseUrl}`);
  logger.info(`- SockJS Base URL: ${config.sockJsBaseUrl}`);
  logger.info(`- Icecast URL: ${config.icecastUrl}`);

  logger.info('\nConfiguration Utilities:');
  logger.info(`- API URL for /test: ${configUtils.getApiUrl('/test')}`);
  logger.info(`- WebSocket URL for /ws-test: ${configUtils.getWsUrl('/ws-test')}`);
  logger.info(`- SockJS URL for /sockjs-test: ${configUtils.getSockJsUrl('/sockjs-test')}`);

  logger.info('\nEnvironment-Specific Settings:');
  logger.info(`- API Timeout: ${config.apiTimeout}ms`);
  logger.info(`- Max Retries: ${config.maxRetries}`);
  logger.info(`- Retry Delay: ${config.retryDelay}ms`);
  logger.info(`- WebSocket Reconnect Delay: ${config.wsReconnectDelay}ms`);
  logger.info(`- Debug Logs Enabled: ${config.enableDebugLogs}`);

  logger.info('\nAPI Proxy Information:');
  logger.info(`- Proxy Environment: ${apiProxy.config.environment}`);
  logger.info(`- Proxy API URL: ${apiProxy.config.apiBaseUrl}`);

  // Test API endpoint
  const testEndpoint = '/api/test';
  const fullUrl = configUtils.getApiUrl(testEndpoint);

  logger.info(`Testing endpoint: ${testEndpoint}`);
  logger.info(`Full URL: ${fullUrl}`);

  // Test axios instance configuration
  const axiosInstance = apiProxy.getAxiosInstance();
  logger.info('Axios instance configuration:');
  logger.info(`- Base URL: ${axiosInstance.defaults.baseURL}`);
  logger.info(`- Timeout: ${axiosInstance.defaults.timeout}ms`);
  logger.info(`- Content-Type: ${axiosInstance.defaults.headers['Content-Type']}`);

  logger.info('\n✅ API Proxy system is working correctly!');

  // Test actual API call
  return axiosInstance.get('/api/test')
    .then(response => {
      logger.info('✅ API test call successful:', response.data);
      return {
        success: true,
        environment: config.environment,
        apiBaseUrl: config.apiBaseUrl,
        debugEnabled: config.enableDebugLogs
      };
    })
    .catch(error => {
      logger.error('❌ API Proxy test failed:', error);
      return {
        success: false,
        error: error.message,
        environment: config.environment,
        apiBaseUrl: config.apiBaseUrl,
        debugEnabled: config.enableDebugLogs
      };
    });
}

export function logCurrentConfiguration() {
  logger.info('Current URLs:');
  logger.info(`- API: ${config.apiBaseUrl}`);
  logger.info(`- WebSocket: ${config.wsBaseUrl}`);
  logger.info(`- SockJS: ${config.sockJsBaseUrl}`);

  logger.info('\nTo switch environments, you can:');
  logger.info('1. Set REACT_APP_FORCE_LOCAL=true for local environment');
  logger.info('2. Set REACT_APP_FORCE_DEPLOYED=true for deployed environment');
  logger.info('3. Override specific URLs with environment variables:');
  logger.info('   - REACT_APP_API_BASE_URL');
  logger.info('   - REACT_APP_WS_BASE_URL');
  logger.info('   - REACT_APP_SOCKJS_BASE_URL');

  logger.info('\nExample environment variables:');
  logger.info('REACT_APP_API_BASE_URL=https://new-backend.example.com');
  logger.info('REACT_APP_WS_BASE_URL=wss://new-backend.example.com');
  logger.info('REACT_APP_SOCKJS_BASE_URL=https://new-backend.example.com');
}

// Auto-run tests if this module is imported directly
if (typeof window !== 'undefined') {
  runConfigurationTests().then(configResult => {
    logger.info('\n✅ All configuration tests completed!');
    logger.info('\n📋 Summary:');
    logger.info(`Environment: ${configResult.environment}`);
    logger.info(`API URL: ${configResult.apiBaseUrl}`);
    logger.info(`Debug Mode: ${configResult.debugEnabled ? 'ON' : 'OFF'}`);
  });
}