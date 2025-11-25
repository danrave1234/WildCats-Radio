import { Redirect } from 'expo-router';
import React from 'react';

export default function IndexScreen() {
  // Redirect directly to listener dashboard (broadcast screen) - no login required
  return <Redirect href="/(tabs)/broadcast" />;
} 