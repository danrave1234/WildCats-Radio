import streamService from './streamService';
import { createLogger } from './logger';

const logger = createLogger('StreamDebugUtils');

/**
 * Comprehensive stream debugging utility
 */
export class StreamDebugUtils {
  
  /**
   * Test all possible stream endpoints and provide detailed report
   */
  static async runStreamDiagnostics(): Promise<void> {
    logger.debug('🔍 Starting comprehensive stream diagnostics...');
    
    console.log('\n🎵 WILDCAT RADIO STREAM DIAGNOSTICS');
    console.log('=====================================');
    
    // 1. Test basic connectivity to domain
    await this.testBasicConnectivity();
    
    // 2. Test all stream format endpoints
    await this.testAllStreamFormats();
    
    // 3. Test backend API endpoints
    await this.testBackendEndpoints();
    
    // 4. Test WebSocket endpoints
    await this.testWebSocketEndpoints();
    
    console.log('=====================================');
    console.log('🔍 Diagnostics complete. Check above for issues.\n');
  }
  
  private static async testBasicConnectivity(): Promise<void> {
    console.log('\n1. Testing basic domain connectivity...');
    
    const domains = [
      'https://icecast.software',
      'https://wildcat-radio-f05d362144e6.autoidleapp.com',
    ];
    
    for (const domain of domains) {
      try {
        const response = await fetch(domain, { 
          method: 'HEAD',
          headers: {
            'User-Agent': 'WildCats-Radio-Mobile/1.0'
          }
        });
        console.log(`✅ ${domain}: ${response.status} ${response.statusText}`);
      } catch (error) {
        console.log(`❌ ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
  
  private static async testAllStreamFormats(): Promise<void> {
    console.log('\n2. Testing MP3 stream endpoint (mobile-exclusive)...');
    
    // Test MP3 stream only (mobile-focused)
    const mp3StreamUrl = 'https://icecast.software/live.mp3';
    
    console.log('   Testing MP3 stream for mobile:');
    try {
      const result = await streamService.testStreamUrl(mp3StreamUrl);
      if (result.accessible) {
        console.log(`   ✅ ${mp3StreamUrl}: Available - MP3 (Mobile) (${result.contentType || 'unknown type'})`);
      } else {
        console.log(`   ❌ ${mp3StreamUrl}: ${result.error}`);
        console.log('   💡 This is normal if no broadcast is currently active');
      }
    } catch (error) {
      console.log(`   ❌ ${mp3StreamUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Test MP3 availability using service method
    console.log('   Testing MP3 availability via service:');
    try {
      const mp3Available = await streamService.isMp3StreamAvailable();
      console.log(`   📊 MP3 Stream Available: ${mp3Available ? '✅ YES' : '❌ NO'}`);
    } catch (error) {
      console.log(`   ❌ MP3 availability test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private static async testBackendEndpoints(): Promise<void> {
    console.log('\n3. Testing backend API endpoints...');
    
    const endpoints = [
      '/api/stream/config',
      '/api/stream/status', 
      '/api/stream/health',
      '/api/stream/websocket-url',
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`https://wildcat-radio-f05d362144e6.autoidleapp.com${endpoint}`);
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ ${endpoint}: OK`);
          if (endpoint === '/api/stream/config') {
            console.log(`   📊 Stream URL: ${data.streamUrl || 'not provided'}`);
            console.log(`   📊 Is Live: ${data.isLive || false}`);
            console.log(`   📊 Listeners: ${data.listenerCount || 0}`);
          }
        } else {
          console.log(`❌ ${endpoint}: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.log(`❌ ${endpoint}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
  
  private static async testWebSocketEndpoints(): Promise<void> {
    console.log('\n4. Testing WebSocket endpoint discovery...');
    
    try {
      const wsUrls = await streamService.getWebSocketUrls();
      console.log('✅ WebSocket URLs retrieved:');
      console.log(`   📡 Chat: ${wsUrls.chatUrl}`);
      console.log(`   📡 Listener: ${wsUrls.listenerUrl}`);
      console.log(`   📡 DJ: ${wsUrls.djUrl}`);
      console.log(`   📡 Broadcast: ${wsUrls.broadcastUrl}`);
    } catch (error) {
      console.log(`❌ WebSocket URL fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Quick stream URL test for debugging
   */
  static async quickStreamTest(url?: string): Promise<void> {
    const testUrl = url || 'https://icecast.software/live.ogg';
    console.log(`\n🔍 Quick test for: ${testUrl}`);
    
    try {
      const result = await streamService.testStreamUrl(testUrl);
      if (result.accessible) {
        console.log(`✅ Stream accessible`);
        console.log(`   📊 Content-Type: ${result.contentType || 'unknown'}`);
      } else {
        console.log(`❌ Stream not accessible: ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get current stream status from backend
   */
  static async getCurrentStreamStatus(): Promise<void> {
    console.log('\n📊 Current Stream Status:');
    
    try {
      const config = await streamService.getStreamConfig();
      const status = await streamService.getStreamStatus();
      
      console.log('Config:', JSON.stringify(config, null, 2));
      console.log('Status:', JSON.stringify(status, null, 2));
    } catch (error) {
      console.log(`❌ Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Quick MP3 stream test for mobile
 */
export async function quickMp3Test(): Promise<void> {
  console.log('🎵 Quick MP3 Stream Test for Mobile');
  console.log('===================================');
  
  const mp3Available = await streamService.isMp3StreamAvailable();
  console.log(`📊 MP3 Stream Status: ${mp3Available ? '✅ AVAILABLE' : '❌ NOT AVAILABLE'}`);
  
  if (!mp3Available) {
    console.log('💡 This is normal if no broadcast is currently active');
    console.log('💡 Start a broadcast from the web frontend to test MP3 streaming');
  }
}

/**
 * Export the main diagnostic function
 */
export const runStreamDiagnostics = StreamDebugUtils.runStreamDiagnostics.bind(StreamDebugUtils);

/**
 * Export the quick test function  
 */
export const quickStreamTest = quickMp3Test;

export const getCurrentStreamStatus = () => StreamDebugUtils.getCurrentStreamStatus(); 