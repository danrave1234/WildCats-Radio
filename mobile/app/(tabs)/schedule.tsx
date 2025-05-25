import React from 'react';
import { View, Text, SafeAreaView, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

const ScheduleScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Schedule' }} />
      <View style={styles.content}>
        <Text style={styles.title}>Schedule Screen</Text>
        <Text style={styles.subtitle}>Radio show schedule and upcoming events will be displayed here.</Text>
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

export default ScheduleScreen; 