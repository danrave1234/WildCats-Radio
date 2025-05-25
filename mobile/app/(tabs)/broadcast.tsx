import React from 'react';
import { View, Text, SafeAreaView, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

const BroadcastScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Broadcast Now' }} />
      <View style={styles.content}>
        <Text style={styles.title}>Broadcast Screen</Text>
        <Text style={styles.subtitle}>DJ controls and live streaming interface will go here.</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E9ECEC',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
  },
});

export default BroadcastScreen; 