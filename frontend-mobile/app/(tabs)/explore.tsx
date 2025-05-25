import React from 'react';
import { StyleSheet, View, Text, SafeAreaView } from 'react-native';
import { ColorPalette } from '@/constants/ColorPalette';
import { StatusBar } from 'expo-status-bar';

export default function ExploreScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Explore</Text>
        
        <View style={styles.headerRight}>
          {/* Empty space to match the schedule.tsx layout */}
        </View>
      </View>
      
      <View style={styles.content}>
        {/* Content goes here */}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ColorPalette.antiFlashWhite.DEFAULT,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: ColorPalette.white.DEFAULT,
    borderBottomWidth: 1,
    borderBottomColor: ColorPalette.antiFlashWhite[400],
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: ColorPalette.cordovan.DEFAULT,
  },
  content: {
    flex: 1,
    padding: 20,
  },
});
