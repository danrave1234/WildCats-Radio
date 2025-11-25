import { Redirect } from 'expo-router';
import React from 'react';

export default function IndexScreen() {
  // Redirect to welcome screen when app resets
  return <Redirect href="/welcome" />;
} 