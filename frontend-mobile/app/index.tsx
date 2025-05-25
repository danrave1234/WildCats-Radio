import React from 'react';
import { StyleSheet, View, Text, SafeAreaView } from 'react-native';
import { ColorPalette } from '@/constants/ColorPalette';
import { Redirect } from 'expo-router';

export default function IndexScreen() {
  // Redirect to homepage 
  return <Redirect href="/(tabs)/homepage" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ColorPalette.antiFlashWhite.DEFAULT,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  screenName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: ColorPalette.cordovan.DEFAULT,
  },
}); 