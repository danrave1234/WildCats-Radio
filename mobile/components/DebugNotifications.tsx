import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { notificationService } from '../services/notificationService';
import { websocketService } from '../services/websocketService';

export default function DebugNotifications() {
  const { notifications, unreadCount, isConnected, addNotification } = useNotifications();
  const { authToken } = useAuth();
  const [testResults, setTestResults] = useState<string[]>([]);

  const runDiagnostics = async () => {
    const results: string[] = [];
    
    // Check auth
    results.push(`🔑 Auth Token: ${authToken ? 'Available' : 'Missing'}`);
    
    // Check WebSocket connection
    results.push(`🔌 WebSocket Connected: ${websocketService.isConnected()}`);
    
    // Check notification context
    results.push(`📢 Notifications Count: ${notifications.length}`);
    results.push(`📬 Unread Count: ${unreadCount}`);
    results.push(`🟢 Context Connected: ${isConnected}`);
    
    // Test API calls
    if (authToken) {
      try {
        const unreadResult = await notificationService.getUnreadCount(authToken);
        results.push(`📊 API Unread Count: ${JSON.stringify(unreadResult)}`);
      } catch (error) {
        results.push(`❌ API Error: ${error}`);
      }
    }
    
    setTestResults(results);
    Alert.alert('Diagnostics Complete', results.join('\n'));
  };

  const testWebSocketConnection = () => {
    if (authToken) {
      console.log('🧪 Manual WebSocket test starting...');
      websocketService.connect(-1, authToken);
      
      websocketService.onMessage((message) => {
        console.log('🧪 Debug: Received WebSocket message:', message);
        Alert.alert('WebSocket Message', JSON.stringify(message, null, 2));
      });
      
      websocketService.onConnect(() => {
        console.log('🧪 Debug: WebSocket connected');
        Alert.alert('WebSocket', 'Connected successfully!');
      });
      
      websocketService.onError((error) => {
        console.log('🧪 Debug: WebSocket error:', error);
        Alert.alert('WebSocket Error', error.toString());
      });
    }
  };

  const testAddNotification = () => {
    
    // Create a test notification with current timestamp
    const testNotification = {
      id: Date.now(), // Use timestamp as unique ID
      message: `Test notification created at ${new Date().toLocaleTimeString()}`,
      type: 'GENERAL',
      timestamp: new Date().toISOString(),
      read: false,
      userId: 1
    };
    
    console.log('🧪 Adding test notification:', testNotification);
    addNotification(testNotification);
    Alert.alert('Test Notification', 'Added a test notification with current timestamp');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔧 Notification Debug Panel</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>📊 Status:</Text>
        <Text style={styles.statusValue}>Auth: {authToken ? '✅' : '❌'}</Text>
        <Text style={styles.statusValue}>WebSocket: {websocketService.isConnected() ? '✅' : '❌'}</Text>
        <Text style={styles.statusValue}>Context: {isConnected ? '✅' : '❌'}</Text>
        <Text style={styles.statusValue}>Notifications: {notifications.length}</Text>
        <Text style={styles.statusValue}>Unread: {unreadCount}</Text>
        {notifications.length > 0 && (
          <Text style={styles.statusValue}>Latest: {new Date(notifications[0].timestamp).toLocaleString()}</Text>
        )}
      </View>
      
      <TouchableOpacity style={styles.button} onPress={runDiagnostics}>
        <Text style={styles.buttonText}>🔍 Run Diagnostics</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={testWebSocketConnection}>
        <Text style={styles.buttonText}>🧪 Test WebSocket</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={testAddNotification}>
        <Text style={styles.buttonText}>➕ Add Test Notification</Text>
      </TouchableOpacity>
      
      {testResults.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>📋 Test Results:</Text>
          {testResults.map((result, index) => (
            <Text key={index} style={styles.resultText}>{result}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#91403E',
  },
  statusContainer: {
    marginBottom: 15,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  statusValue: {
    fontSize: 14,
    marginLeft: 10,
    marginBottom: 2,
  },
  button: {
    backgroundColor: '#91403E',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },
  resultsContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  resultText: {
    fontSize: 12,
    marginBottom: 2,
    fontFamily: 'monospace',
  },
}); 