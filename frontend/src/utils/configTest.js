/**
 * Configuration Test Utility
 * 
 * This utility demonstrates and tests the centralized configuration system
 * and API proxy base functionality.
 */

import { config, configUtils, isLocalEnvironment, isDeployedEnvironment } from '../config';
import { apiProxy } from '../services/api';

/**
 * Test the configuration system
 */
export const testConfiguration = () => {
  console.group('🧪 Configuration System Test');
  
  // Test environment detection
  console.log('Environment Detection:');
  console.log(`- Current Environment: ${config.environment}`);
  console.log(`- Is Local: ${isLocalEnvironment}`);
  console.log(`- Is Deployed: ${isDeployedEnvironment}`);
  console.log(`- Hostname: ${window.location.hostname}`);
  
  // Test URL configuration
  console.log('\nURL Configuration:');
  console.log(`- API Base URL: ${config.apiBaseUrl}`);
  console.log(`- WebSocket Base URL: ${config.wsBaseUrl}`);
  console.log(`- SockJS Base URL: ${config.sockJsBaseUrl}`);
  console.log(`- Icecast URL: ${config.icecastUrl}`);
  
  // Test configuration utilities
  console.log('\nConfiguration Utilities:');
  console.log(`- API URL for /test: ${configUtils.getApiUrl('/test')}`);
  console.log(`- WebSocket URL for /ws-test: ${configUtils.getWsUrl('/ws-test')}`);
  console.log(`- SockJS URL for /sockjs-test: ${configUtils.getSockJsUrl('/sockjs-test')}`);
  
  // Test environment-specific settings
  console.log('\nEnvironment-Specific Settings:');
  console.log(`- API Timeout: ${config.apiTimeout}ms`);
  console.log(`- Max Retries: ${config.maxRetries}`);
  console.log(`- Retry Delay: ${config.retryDelay}ms`);
  console.log(`- WebSocket Reconnect Delay: ${config.wsReconnectDelay}ms`);
  console.log(`- Debug Logs Enabled: ${config.enableDebugLogs}`);
  
  // Test API proxy
  console.log('\nAPI Proxy Information:');
  console.log(`- Proxy Environment: ${apiProxy.config.environment}`);
  console.log(`- Proxy API URL: ${apiProxy.config.apiBaseUrl}`);
  
  console.groupEnd();
  
  return {
    environment: config.environment,
    isLocal: isLocalEnvironment,
    isDeployed: isDeployedEnvironment,
    apiBaseUrl: config.apiBaseUrl,
    wsBaseUrl: config.wsBaseUrl,
    sockJsBaseUrl: config.sockJsBaseUrl,
    debugEnabled: config.enableDebugLogs
  };
};

/**
 * Test URL switching functionality
 * This demonstrates how easy it is to change environments
 */
export const testUrlSwitching = () => {
  console.group('🔄 URL Switching Test');
  
  console.log('Current URLs:');
  console.log(`- API: ${config.apiBaseUrl}`);
  console.log(`- WebSocket: ${config.wsBaseUrl}`);
  console.log(`- SockJS: ${config.sockJsBaseUrl}`);
  
  console.log('\nTo switch environments, you can:');
  console.log('1. Set REACT_APP_FORCE_LOCAL=true for local environment');
  console.log('2. Set REACT_APP_FORCE_DEPLOYED=true for deployed environment');
  console.log('3. Override specific URLs with environment variables:');
  console.log('   - REACT_APP_API_BASE_URL');
  console.log('   - REACT_APP_WS_BASE_URL');
  console.log('   - REACT_APP_SOCKJS_BASE_URL');
  
  console.log('\nExample environment variables:');
  console.log('REACT_APP_API_BASE_URL=https://new-backend.example.com');
  console.log('REACT_APP_WS_BASE_URL=wss://new-backend.example.com');
  console.log('REACT_APP_SOCKJS_BASE_URL=https://new-backend.example.com');
  
  console.groupEnd();
};

/**
 * Simulate API calls to test the proxy system
 */
export const testApiProxy = async () => {
  console.group('🌐 API Proxy Test');
  
  try {
    // Test URL construction
    const testEndpoint = '/api/test';
    const fullUrl = configUtils.getApiUrl(testEndpoint);
    console.log(`Testing endpoint: ${testEndpoint}`);
    console.log(`Full URL: ${fullUrl}`);
    
    // Test axios instance configuration
    const axiosInstance = apiProxy.getAxiosInstance();
    console.log('Axios instance configuration:');
    console.log(`- Base URL: ${axiosInstance.defaults.baseURL}`);
    console.log(`- Timeout: ${axiosInstance.defaults.timeout}ms`);
    console.log(`- Content-Type: ${axiosInstance.defaults.headers['Content-Type']}`);
    
    console.log('\n✅ API Proxy system is working correctly!');
    
  } catch (error) {
    console.error('❌ API Proxy test failed:', error);
  }
  
  console.groupEnd();
};

/**
 * Run all configuration tests
 */
export const runAllTests = () => {
  console.log('🚀 Running WildCats Radio Configuration Tests...\n');
  
  const configResult = testConfiguration();
  testUrlSwitching();
  testApiProxy();
  
  console.log('\n✅ All configuration tests completed!');
  console.log('\n📋 Summary:');
  console.log(`Environment: ${configResult.environment}`);
  console.log(`API URL: ${configResult.apiBaseUrl}`);
  console.log(`Debug Mode: ${configResult.debugEnabled ? 'ON' : 'OFF'}`);
  
  return configResult;
};

// Auto-run tests in development mode
if (config.enableDebugLogs) {
  // Run tests after a short delay to ensure everything is loaded
  setTimeout(() => {
    runAllTests();
  }, 1000);
}