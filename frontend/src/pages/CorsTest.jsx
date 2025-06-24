import React, { useState, useEffect } from 'react';
import { config } from '../config';

const CorsTest = () => {
  const [testResults, setTestResults] = useState({
    apiTest: null,
    wsTest: null,
    loading: true
  });

  useEffect(() => {
    runTests();
  }, []);

  const runTests = async () => {
    setTestResults(prev => ({ ...prev, loading: true }));
    
    // Test API connectivity
    const apiResult = await testApiConnectivity();
    
    // Test WebSocket connectivity
    const wsResult = await testWebSocketConnectivity();
    
    setTestResults({
      apiTest: apiResult,
      wsTest: wsResult,
      loading: false
    });
  };

  const testApiConnectivity = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stream/cors-test`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data,
        message: 'API connectivity successful'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'API connectivity failed'
      };
    }
  };

  const testWebSocketConnectivity = () => {
    return new Promise((resolve) => {
      try {
        const wsUrl = `${config.wsBaseUrl}/ws/live`;
        const ws = new WebSocket(wsUrl);
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve({
            success: false,
            error: 'WebSocket connection timeout',
            message: 'WebSocket connectivity failed'
          });
        }, 10000); // 10 second timeout

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve({
            success: true,
            message: 'WebSocket connectivity successful'
          });
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          resolve({
            success: false,
            error: error.message || 'WebSocket connection error',
            message: 'WebSocket connectivity failed'
          });
        };

        ws.onclose = (event) => {
          if (event.code !== 1000) { // 1000 = normal closure
            clearTimeout(timeout);
            resolve({
              success: false,
              error: `WebSocket closed unexpectedly (code: ${event.code})`,
              message: 'WebSocket connectivity failed'
            });
          }
        };
      } catch (error) {
        resolve({
          success: false,
          error: error.message,
          message: 'WebSocket connectivity failed'
        });
      }
    });
  };

  const getStatusColor = (success) => {
    return success ? 'text-green-600' : 'text-red-600';
  };

  const getStatusIcon = (success) => {
    return success ? '✅' : '❌';
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-center mb-8">CORS Connectivity Test</h1>
          
          {/* Configuration Info */}
          <div className="mb-8 p-4 bg-blue-50 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Current Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Backend Mode:</span> {config.apiBaseUrl.includes('localhost') ? 'Local' : 'Cloud'}
              </div>
              <div>
                <span className="font-medium">API Base URL:</span> {config.apiBaseUrl}
              </div>
              <div>
                <span className="font-medium">WebSocket URL:</span> {config.wsBaseUrl}
              </div>
              <div>
                <span className="font-medium">API Timeout:</span> {config.apiTimeout}ms
              </div>
            </div>
          </div>

          {/* Test Results */}
          <div className="space-y-6">
            <button
              onClick={runTests}
              disabled={testResults.loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {testResults.loading ? 'Running Tests...' : 'Run Tests Again'}
            </button>

            {/* API Test */}
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-semibold mb-2">
                {getStatusIcon(testResults.apiTest?.success)} API Connectivity Test
              </h3>
              {testResults.apiTest && (
                <div>
                  <p className={`mb-2 ${getStatusColor(testResults.apiTest.success)}`}>
                    {testResults.apiTest.message}
                  </p>
                  {testResults.apiTest.success && testResults.apiTest.data && (
                    <div className="bg-green-50 p-3 rounded text-sm">
                      <pre>{JSON.stringify(testResults.apiTest.data, null, 2)}</pre>
                    </div>
                  )}
                  {!testResults.apiTest.success && (
                    <div className="bg-red-50 p-3 rounded text-sm">
                      <strong>Error:</strong> {testResults.apiTest.error}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* WebSocket Test */}
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-semibold mb-2">
                {getStatusIcon(testResults.wsTest?.success)} WebSocket Connectivity Test
              </h3>
              {testResults.wsTest && (
                <div>
                  <p className={`mb-2 ${getStatusColor(testResults.wsTest.success)}`}>
                    {testResults.wsTest.message}
                  </p>
                  {!testResults.wsTest.success && (
                    <div className="bg-red-50 p-3 rounded text-sm">
                      <strong>Error:</strong> {testResults.wsTest.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Troubleshooting Tips */}
          <div className="mt-8 p-4 bg-yellow-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Troubleshooting Tips</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>If API test fails, check if the backend server is running and accessible</li>
              <li>If WebSocket test fails, check firewall settings and proxy configurations</li>
              <li>For cloud backend, ensure CORS origins include your local development server</li>
              <li>Check browser console for detailed error messages</li>
              <li>Verify that the backend CORS configuration includes your frontend origin</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CorsTest; 