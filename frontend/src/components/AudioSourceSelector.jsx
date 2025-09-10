import React, { useState, useEffect } from 'react';
import { MicrophoneIcon, ComputerDesktopIcon, SpeakerWaveIcon, ExclamationTriangleIcon, Cog6ToothIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useStreaming } from '../context/StreamingContext';
import { createLogger } from '../services/logger';

const logger = createLogger('AudioSourceSelector');

const AudioSourceSelector = ({ disabled = false, showHeading = true, compact = false }) => {
  const { 
    audioSource, 
    setAudioSource, 
    isLive, 
    audioStreamRef, 
    getDesktopAudioStream
  } = useStreaming();
  const [browserSupport, setBrowserSupport] = useState({
    microphone: true,
    desktop: true,
    both: true
  });
  const [currentAudioDevice, setCurrentAudioDevice] = useState(null);
  const [showSourceSelector, setShowSourceSelector] = useState(false);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [deviceError, setDeviceError] = useState(null);
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [testAudioStream, setTestAudioStream] = useState(null);
  const [isCapturingAudio, setIsCapturingAudio] = useState(false);

  // Check browser support on component mount
  useEffect(() => {
    const checkBrowserSupport = () => {
      logger.info('Checking browser support for audio capture');
      const support = {
        microphone: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        desktop: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && window.isSecureContext),
        both: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && navigator.mediaDevices.getDisplayMedia && window.isSecureContext)
      };
      logger.debug('Browser support results:', support);
      setBrowserSupport(support);

      if (!support.desktop) {
        logger.warn('Desktop audio capture not supported:', {
          hasMediaDevices: !!navigator.mediaDevices,
          hasGetDisplayMedia: !!navigator.mediaDevices?.getDisplayMedia,
          isSecureContext: window.isSecureContext
        });
      }
    };

    checkBrowserSupport();
  }, []);

  // Enumerate available audio devices
  const enumerateAudioDevices = async () => {
    logger.info('Starting audio device enumeration');
    try {
      setIsLoadingDevices(true);
      setDeviceError(null);

      // For DJ use, we only need desktop audio capture
      // No need to enumerate microphones as DJs use mixer software
      const deviceList = [
        {
          deviceId: 'desktop',
          label: 'Desktop Audio (System Audio)',
          kind: 'desktop',
          icon: ComputerDesktopIcon,
          description: 'Capture system audio from your DJ mixer software',
          color: 'bg-green-100 text-green-600 border-green-200 hover:bg-green-200'
        }
      ];

      logger.debug('Audio device list prepared:', { deviceCount: deviceList.length });
      setAvailableDevices(deviceList);
      logger.info('Audio device enumeration completed successfully');
    } catch (error) {
      logger.error('Error enumerating audio devices:', error);
      setDeviceError('Failed to load audio devices. Please check permissions.');
      // Fallback to desktop audio only
      const fallbackDevices = [{
        deviceId: 'desktop',
        label: 'Desktop Audio (System Audio)',
        kind: 'desktop',
        icon: ComputerDesktopIcon,
        description: 'Capture system audio from your DJ mixer software',
        color: 'bg-green-100 text-green-600 border-green-200 hover:bg-green-200'
      }];
      setAvailableDevices(fallbackDevices);
      logger.warn('Using fallback device list due to enumeration error');
    } finally {
      setIsLoadingDevices(false);
      logger.debug('Audio device enumeration process completed');
    }
  };

  // Get current audio device information
  useEffect(() => {
    const getCurrentAudioDevice = () => {
      logger.debug('Updating current audio device information');
      if (audioStreamRef?.current) {
        const audioTracks = audioStreamRef.current.getAudioTracks();
        logger.debug('Audio stream found:', {
          streamId: audioStreamRef.current.id,
          active: audioStreamRef.current.active,
          trackCount: audioTracks.length
        });

        if (audioTracks.length > 0) {
          const track = audioTracks[0];
          const deviceInfo = {
            label: track.label || 'Desktop Audio',
            kind: track.kind,
            enabled: track.enabled,
            readyState: track.readyState
          };
          setCurrentAudioDevice(deviceInfo);
          logger.debug('Current audio device set:', deviceInfo);
        } else {
          logger.warn('Audio stream exists but has no audio tracks');
          // If audioSource is set but no tracks, show as selected but inactive
          if (audioSource) {
            setCurrentAudioDevice({
              label: 'Desktop Audio (Selected)',
              kind: 'desktop',
              enabled: false,
              readyState: 'inactive'
            });
          } else {
            setCurrentAudioDevice(null);
          }
        }
      } else {
        logger.debug('No audio stream reference found');
        // If audioSource is set but no stream reference, show as selected but not connected
        if (audioSource && audioSource !== 'none') {
          logger.debug('Audio source is set but no stream reference, showing as selected');
          setCurrentAudioDevice({
            label: 'Desktop Audio (Selected)',
            kind: 'desktop',
            enabled: false,
            readyState: 'selected'
          });
        } else {
          setCurrentAudioDevice(null);
        }
      }
    };

    getCurrentAudioDevice();
  }, [audioStreamRef, isLive, audioSource]);

  // Load devices when component mounts or when showing selector
  useEffect(() => {
    if (showSourceSelector && availableDevices.length === 0) {
      enumerateAudioDevices();
    }
  }, [showSourceSelector, availableDevices.length]);

  // Function to actually capture desktop audio
  const handleSourceChange = async (deviceId) => {
    if (disabled || isLive) {
      logger.warn('Cannot change audio source: disabled or live', { disabled, isLive });
      return;
    }

    logger.info('Starting audio source change:', { deviceId });

    try {
      setIsCapturingAudio(true);
      setDeviceError(null);

      if (deviceId === 'desktop') {
        logger.debug('Triggering desktop audio capture dialog');
        // Trigger the browser's desktop audio capture dialog
        const stream = await getDesktopAudioStream();
        if (stream) {
          logger.info('Desktop audio stream obtained successfully:', {
            streamId: stream.id,
            active: stream.active,
            audioTracks: stream.getAudioTracks().length
          });

          // Store the stream in audioStreamRef so the component knows it's connected
          if (audioStreamRef && audioStreamRef.current) {
            logger.debug('Stopping existing audio stream before replacing');
            // Stop any existing stream first
            audioStreamRef.current.getTracks().forEach(track => track.stop());
          }

          // Update the audio stream reference
          if (audioStreamRef) {
            audioStreamRef.current = stream;
            logger.debug('Audio stream reference updated');
          }

          setAudioSource(deviceId);
          logger.info('Audio source set to:', deviceId);

          // Manually update the current audio device state since refs don't trigger re-renders
          const audioTracks = stream.getAudioTracks();
          if (audioTracks.length > 0) {
            const track = audioTracks[0];
            const deviceInfo = {
              label: track.label || 'Desktop Audio',
              kind: track.kind,
              enabled: track.enabled,
              readyState: track.readyState
            };
            setCurrentAudioDevice(deviceInfo);
            logger.debug('Current audio device updated:', deviceInfo);
          }
        } else {
          logger.warn('Desktop audio stream was null or undefined');
        }
      }
    } catch (error) {
      logger.error('Error capturing audio source:', error);
      setDeviceError(error.message || 'Failed to capture audio source');
    } finally {
      setIsCapturingAudio(false);
      logger.debug('Audio source change process completed');
    }
  };

  // Function to test audio without broadcasting (loopback)
  const handleTestAudio = async () => {
    try {
      logger.info('Starting audio test with already selected source');
      setIsTestingAudio(true);
      setDeviceError(null);

      // Check if we have an existing audio stream to test
      if (!audioStreamRef?.current) {
        logger.warn('No audio source selected for testing');
        setDeviceError('No audio source selected. Please select an audio source first.');
        setIsTestingAudio(false);
        return;
      }

      // Use the existing audio stream for testing instead of prompting for a new one
      const stream = audioStreamRef.current;
      logger.debug('Using existing audio stream for testing:', {
        streamId: stream.id,
        active: stream.active,
        audioTracks: stream.getAudioTracks().length
      });

      // Validate the stream is still active
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0 || audioTracks.every(track => track.readyState === 'ended')) {
        logger.error('Selected audio stream is no longer active');
        setDeviceError('Selected audio source is no longer active. Please select a new audio source.');
        setIsTestingAudio(false);
        return;
      }

      // Clone the stream for testing to avoid interfering with the original
      const testStream = stream.clone();
      setTestAudioStream(testStream);

      // Create audio element for loopback testing
      const audio = new Audio();
      audio.srcObject = testStream;
      audio.volume = 0.5; // Set to moderate volume for testing

      try {
        await audio.play();
        logger.info('Audio test started successfully - loopback audio should be audible');
      } catch (playError) {
        logger.error('Failed to start audio playback:', playError);
        throw new Error('Failed to start audio playback. This may be due to browser autoplay restrictions.');
      }

      // Stop test after 10 seconds
      setTimeout(() => {
        logger.info('Auto-stopping audio test after 10 seconds');
        handleStopTest();
      }, 10000);

    } catch (error) {
      logger.error('Error testing audio:', error);
      setDeviceError(error.message || 'Failed to test audio source');
      setIsTestingAudio(false);
    }
  };

  // Function to stop audio test
  const handleStopTest = () => {
    logger.info('Stopping audio test');
    if (testAudioStream) {
      logger.debug('Stopping test audio stream tracks:', {
        streamId: testAudioStream.id,
        trackCount: testAudioStream.getTracks().length
      });
      testAudioStream.getTracks().forEach(track => track.stop());
      setTestAudioStream(null);
    }
    setIsTestingAudio(false);
    logger.info('Audio test stopped successfully');
  };

  const containerSpacing = compact ? 'space-y-2' : 'space-y-3';
  const panelPadding = compact ? 'p-3' : 'p-4';
  const panelBorder = compact ? 'border' : 'border-2';
  const iconSizeOuter = compact ? 'w-5 h-5' : 'w-6 h-6';
  const iconSizeInner = compact ? 'w-4 h-4' : 'w-6 h-6';
  const titleTextSize = compact ? 'text-sm' : '';
  const subtitleTextSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div className={containerSpacing}>
      {showHeading && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            Audio Source
          </h3>
          {isLive && (
            <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
              Cannot change while live
            </span>
          )}
        </div>
      )}

      {/* Current Connected Audio Source Display */}
      {currentAudioDevice && (
        <div className={`${panelPadding} bg-green-50 ${panelBorder} border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-600`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`${iconSizeOuter} bg-green-100 rounded-full flex items-center justify-center`}>
                <ComputerDesktopIcon className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h4 className={`font-medium text-green-700 dark:text-green-300 ${titleTextSize}`}>
                  {currentAudioDevice.label || 'Desktop Audio'}
                </h4>
                <p className={`${subtitleTextSize} text-green-600 dark:text-green-400`}>
                  {currentAudioDevice.enabled ? 'Connected and Ready' : 'Selected but not connected'}
                </p>
              </div>
            </div>
            {!isLive && (
              <div className="flex space-x-2">
                <button
                  onClick={() => handleSourceChange('desktop')}
                  className={`flex items-center space-x-2 ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} font-medium text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200 transition-colors`}
                >
                  <Cog6ToothIcon className="w-4 h-4" />
                  <span>Change</span>
                </button>
                <button
                  onClick={isTestingAudio ? handleStopTest : handleTestAudio}
                  disabled={disabled}
                  className={`${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} font-medium rounded-lg transition-colors ${
                    isTestingAudio 
                      ? 'text-red-700 bg-red-100 hover:bg-red-200 border border-red-300' 
                      : 'text-blue-700 bg-blue-100 hover:bg-blue-200 border border-blue-300'
                  }`}
                >
                  {isTestingAudio ? 'Stop Test' : 'Test Audio'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No Audio Source Connected */}
      {!currentAudioDevice && !showSourceSelector && (
        <div className={`${panelPadding} bg-gray-50 ${panelBorder} border-gray-200 rounded-lg dark:bg-gray-800 dark:border-gray-600`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ComputerDesktopIcon className={`${iconSizeInner} text-gray-400`} />
              <div>
                <h4 className={`font-medium text-gray-700 dark:text-gray-300 ${titleTextSize}`}>
                  No Audio Source Connected
                </h4>
                <p className={`${subtitleTextSize} text-gray-500 dark:text-gray-400`}>
                  Click "Select Source" to choose an audio input
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handleSourceChange('desktop')}
                disabled={disabled || isCapturingAudio}
                className={`${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-lg transition-colors`}
              >
                {isCapturingAudio ? 'Capturing...' : 'Select Source'}
              </button>
              {currentAudioDevice && (
                <button
                  onClick={isTestingAudio ? handleStopTest : handleTestAudio}
                  disabled={disabled}
                  className={`${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} font-medium rounded-lg transition-colors ${
                    isTestingAudio 
                      ? 'text-red-700 bg-red-100 hover:bg-red-200 border border-red-300' 
                      : 'text-green-700 bg-green-100 hover:bg-green-200 border border-green-300'
                  }`}
                >
                  {isTestingAudio ? 'Stop Test' : 'Test Audio'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Audio Source Selection (only shown when changing source) */}
      {showSourceSelector && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-medium text-gray-900 dark:text-white">
              Select Audio Source
            </h4>
            <button
              onClick={() => setShowSourceSelector(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <span className="sr-only">Close</span>
              ✕
            </button>
          </div>

          {/* Loading State */}
          {isLoadingDevices && (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-300">Loading audio devices...</span>
            </div>
          )}

          {/* Error State */}
          {deviceError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
              <div className="flex items-start space-x-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-800 dark:text-red-300">
                  <p className="font-medium mb-1">Error Loading Devices</p>
                  <p>{deviceError}</p>
                  <button
                    onClick={enumerateAudioDevices}
                    className="mt-2 px-3 py-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 rounded transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Available Devices */}
          {!isLoadingDevices && !deviceError && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableDevices.map((device) => {
                const Icon = device.icon;
                const isSelected = audioSource === device.deviceId;
                const isDisabled = disabled || isLive;

                return (
                  <button
                    key={device.deviceId}
                    onClick={() => {
                      handleSourceChange(device.deviceId);
                      setShowSourceSelector(false);
                    }}
                    disabled={isDisabled}
                    className={`
                      relative p-4 border-2 rounded-lg transition-all duration-200 text-left
                      ${isSelected 
                        ? `${device.color} border-current shadow-md` 
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                      }
                      ${isDisabled
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'cursor-pointer'
                      }
                    `}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="relative">
                        <Icon className={`w-6 h-6 mt-0.5 flex-shrink-0 ${
                          isSelected ? 'text-current' : 'text-gray-400'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm mb-1">
                          {device.label}
                        </h4>
                        <p className="text-xs opacity-75 line-clamp-2">
                          {device.description}
                        </p>
                        {device.kind === 'audioinput' && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            Microphone Input
                          </p>
                        )}
                        {device.kind === 'desktop' && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            System Audio
                          </p>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <div className="w-3 h-3 bg-current rounded-full"></div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* No Devices Found */}
          {!isLoadingDevices && !deviceError && availableDevices.length === 0 && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg dark:bg-gray-800 dark:border-gray-600">
              <div className="text-center text-gray-600 dark:text-gray-300">
                <ComputerDesktopIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="font-medium">No Audio Devices Found</p>
                <p className="text-sm mt-1">Please check your audio device connections and permissions.</p>
                <button
                  onClick={enumerateAudioDevices}
                  className="mt-2 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Refresh Devices
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audio Testing Status */}
      {isTestingAudio && (
        <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
          <div className="flex items-center space-x-3">
            <div className="animate-pulse">
              <SpeakerWaveIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium text-blue-800 dark:text-blue-200">
                Testing Audio - Listen for Sound
              </h4>
              <p className="text-sm text-blue-600 dark:text-blue-300">
                You should hear the captured audio playing back. Test will stop automatically in 10 seconds.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {deviceError && (
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
          <div className="flex items-start space-x-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-800 dark:text-red-200 mb-1">
                Audio Capture Error
              </h4>
              <p className="text-sm text-red-600 dark:text-red-300">
                {deviceError}
              </p>
              <button
                onClick={() => setDeviceError(null)}
                className="mt-2 px-3 py-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 rounded transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help text and warnings - only show when selecting source */}
      {showSourceSelector && (
        <>
          {audioSource === 'desktop' && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-900/20 dark:border-amber-800">
              <div className="flex items-start space-x-2">
                <ComputerDesktopIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <p className="font-medium mb-1">Desktop Audio Capture</p>
                  <p>Your browser will prompt you to select which audio to capture. Choose "System Audio" or a specific application tab.</p>
                </div>
              </div>
            </div>
          )}

          {/* Browser Compatibility Warning */}
          {!browserSupport.desktop && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-800">
              <div className="flex items-start space-x-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-800 dark:text-yellow-300">
                  <p className="font-medium mb-1">Desktop Audio Not Available</p>
                  <div className="space-y-1">
                    {!window.isSecureContext && (
                      <p>• Requires HTTPS connection (or localhost for development)</p>
                    )}
                    {!navigator.mediaDevices?.getDisplayMedia && (
                      <p>• Browser doesn't support desktop audio capture API</p>
                    )}
                    <p>• Try using Chrome, Firefox, or Edge browsers</p>
                    <p>• Desktop audio capture is required for DJ broadcasting</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AudioSourceSelector; 
