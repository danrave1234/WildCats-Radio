import React, { useState } from 'react';
import { 
  MicrophoneIcon, 
  SpeakerWaveIcon, 
  SpeakerXMarkIcon,
  ComputerDesktopIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import { useStreaming } from '../context/StreamingContext';

const DJAudioControls = () => {
  const { 
    isLive, 
    isDJMuted, 
    djAudioGain, 
    audioSource,
    noiseGateEnabled,
    noiseGateThreshold,
    audioLevel,
    toggleDJMute, 
    setDJAudioLevel, 
    switchAudioSourceLive,
    setNoiseGateEnabled,
    setNoiseGateThreshold
  } = useStreaming();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSwitchingSource, setIsSwitchingSource] = useState(false);

  // Convert gain (0-1) to percentage (0-100) for UI
  const volumePercentage = Math.round(djAudioGain * 100);

  const handleVolumeChange = (e) => {
    const percentage = parseInt(e.target.value, 10);
    const gain = percentage / 100;
    setDJAudioLevel(gain);
  };

  const handleSourceSwitch = async (newSource) => {
    if (newSource === audioSource) return;
    
    setIsSwitchingSource(true);
    try {
      await switchAudioSourceLive(newSource);
    } catch (error) {
      console.error('Failed to switch audio source:', error);
      
      // Provide specific, user-friendly error messages based on the error type
      let errorMessage = '';
      const errorMsg = error.message || '';
      
      if (errorMsg.includes('validation failed') || errorMsg.includes('No active audio tracks')) {
        errorMessage = `Audio source switching failed: The ${newSource} audio source is not ready or compatible.\n\n` +
          `Your broadcast is still running with the previous audio source.\n` +
          `Try again in a moment, or check your audio device settings.`;
      } else if (errorMsg.includes('MediaRecorder start failed') || errorMsg.includes('NotSupportedError')) {
        errorMessage = `Audio source switching failed: Browser compatibility issue with ${newSource} audio.\n\n` +
          `Your broadcast is still running with the previous audio source.\n` +
          `This is a browser limitation. Try refreshing the page or using a different browser.`;
      } else if (errorMsg.includes('Permission denied') || errorMsg.includes('NotAllowedError')) {
        errorMessage = `Audio source switching failed: Permission denied for ${newSource} audio.\n\n` +
          `Your broadcast is still running with the previous audio source.\n` +
          `Please allow microphone/screen sharing access and try again.`;
      } else if (errorMsg.includes('Desktop audio capture failed') || errorMsg.includes('getDisplayMedia')) {
        errorMessage = `Desktop audio switching failed: Could not access desktop audio.\n\n` +
          `Your broadcast is still running with microphone audio.\n` +
          `Make sure to select a source with audio (like a browser tab with music) when prompted.`;
      } else if (errorMsg.includes('stream became inactive') || errorMsg.includes('tracks have ended') || errorMsg.includes('screen sharing is cancelled')) {
        errorMessage = `Audio source switching failed: The audio stream was disconnected during the switch.\n\n` +
          `Your broadcast is still running with the previous audio source.\n` +
          `This commonly happens when:\n` +
          `• Screen sharing dialog is closed too quickly\n` +
          `• The selected audio source stops playing\n` +
          `• Audio device is disconnected\n\n` +
          `Try again and keep the sharing dialog open until switching completes.`;
      } else if (errorMsg.includes('No audio track found') || errorMsg.includes('select a source with audio')) {
        errorMessage = `Desktop audio switching failed: No audio found in the selected source.\n\n` +
          `Your broadcast is still running with the previous audio source.\n` +
          `Please select a source that has audio (like a browser tab playing music) or choose "System Audio" when prompted.`;
      } else {
        // Generic fallback message
        errorMessage = `Audio source switching failed, but your broadcast continues running.\n\n` +
          `No interruption to your live stream.\n` +
          `${errorMsg || 'Please try again or refresh the page if the issue persists.'}`;
      }
      
      // Show user-friendly error message
      alert(errorMessage);
    } finally {
      setIsSwitchingSource(false);
    }
  };

  const audioSources = [
    { id: 'microphone', name: 'Mic', icon: MicrophoneIcon },
    { id: 'desktop', name: 'Desktop', icon: ComputerDesktopIcon },
    { id: 'both', name: 'Mixed', icon: SpeakerWaveIcon }
  ];

  if (!isLive) {
    return null; // Only show during live broadcast
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
          <AdjustmentsHorizontalIcon className="h-4 w-4 mr-2" />
          DJ Audio Controls
        </h3>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {showAdvanced ? 'Simple' : 'Advanced'}
        </button>
      </div>

      <div className="space-y-3">
        {/* Mute Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">Mute Audio</span>
          <button
            onClick={toggleDJMute}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isDJMuted 
                ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
            }`}
            title={isDJMuted ? 'Unmute' : 'Mute'}
          >
            {isDJMuted ? (
              <SpeakerXMarkIcon className="h-5 w-5" />
            ) : (
              <SpeakerWaveIcon className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Volume Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Volume</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {volumePercentage}%
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="0"
              max="100"
              value={volumePercentage}
              onChange={handleVolumeChange}
              disabled={isDJMuted}
              className={`w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600 ${
                isDJMuted ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
        </div>

        {/* Advanced Controls */}
        {showAdvanced && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-3">
            {/* Audio Level Monitor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Audio Level</span>
                <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                  {audioLevel > -60 ? `${audioLevel.toFixed(1)} dB` : 'Silent'}
                </span>
              </div>
              <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-100 ${
                    audioLevel > -20 ? 'bg-red-500' : 
                    audioLevel > -30 ? 'bg-yellow-500' : 
                    'bg-green-500'
                  }`}
                  style={{ 
                    width: `${Math.max(0, (audioLevel + 60) / 60 * 100)}%` 
                  }}
                />
                {/* Noise gate threshold indicator */}
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-blue-600 dark:bg-blue-400"
                  style={{ 
                    left: `${Math.max(0, (noiseGateThreshold + 60) / 60 * 100)}%` 
                  }}
                  title="Noise Gate Threshold"
                />
              </div>
            </div>

            {/* Noise Gate Controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Noise Gate</span>
                <button
                  onClick={() => setNoiseGateEnabled(!noiseGateEnabled)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    noiseGateEnabled 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {noiseGateEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              
              {noiseGateEnabled && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Threshold</span>
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                      {noiseGateThreshold} dB
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-70"
                    max="-20"
                    value={noiseGateThreshold}
                    onChange={(e) => setNoiseGateThreshold(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Lower values (-70dB) cut more background noise but may affect voice
                  </p>
                </div>
              )}
            </div>

            {/* Audio Source Switching */}
            <div className="space-y-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Audio Source</span>
              <div className="grid grid-cols-3 gap-2">
                {audioSources.map((source) => {
                  const Icon = source.icon;
                  const isActive = audioSource === source.id;
                  const isDisabled = isSwitchingSource;
                  
                  return (
                    <button
                      key={source.id}
                      onClick={() => handleSourceSwitch(source.id)}
                      disabled={isDisabled}
                      className={`
                        p-2 rounded-lg text-xs font-medium transition-all duration-200 
                        flex flex-col items-center space-y-1
                        ${isActive 
                          ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-600' 
                          : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }
                        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{source.name}</span>
                    </button>
                  );
                })}
              </div>
              {isSwitchingSource && (
                <div className="text-xs text-amber-600 dark:text-amber-400 text-center space-y-1">
                  <p>Switching audio source...</p>
                  <p className="text-gray-500 dark:text-gray-400">
                    Brief pause expected (~1 second)
                  </p>
                </div>
              )}
            </div>

            {/* Current Status */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                <span className={`font-medium ${
                  isDJMuted 
                    ? 'text-red-600 dark:text-red-400' 
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {isDJMuted ? 'Muted' : 'Live'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Source:</span>
                <span className="font-medium text-gray-900 dark:text-white capitalize">
                  {audioSource === 'both' ? 'Mixed' : audioSource}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Noise Gate:</span>
                <span className={`font-medium ${
                  noiseGateEnabled 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {noiseGateEnabled ? `${noiseGateThreshold}dB` : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Audio Level:</span>
                <span className={`font-medium font-mono ${
                  audioLevel > noiseGateThreshold 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {audioLevel > -60 ? `${audioLevel.toFixed(1)}dB` : 'Silent'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DJAudioControls; 