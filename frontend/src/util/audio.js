/**
 * Audio utility functions for the WildCats Radio application
 */

/**
 * Creates an audio context and analyser for visualizing audio levels
 * 
 * @param {MediaStream} stream - Audio stream from getUserMedia
 * @returns {Object} Object containing audio context, analyser, and source
 */
export function createAudioAnalyser(stream) {
  if (!stream) {
    return null;
  }
  
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioContext.createAnalyser();
  
  // Configure analyser for real-time visualization
  analyser.fftSize = 256; // Must be power of 2
  analyser.smoothingTimeConstant = 0.8; // Smoother transitions (0-1)
  
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  
  return { audioContext, analyser, source };
}

/**
 * Calculate audio level from analyser node
 * 
 * @param {AnalyserNode} analyser - Web Audio API analyser node
 * @returns {number} Audio level as percentage (0-100)
 */
export function getAudioLevel(analyser) {
  if (!analyser) {
    return 0;
  }
  
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  analyser.getByteFrequencyData(dataArray);
  
  // Calculate average level
  let sum = 0;
  for (let i = 0; i < bufferLength; i++) {
    sum += dataArray[i];
  }
  
  const average = sum / bufferLength;
  // Convert to percentage (0-100)
  return Math.round((average / 255) * 100);
}

/**
 * Start audio visualization with callback
 * 
 * @param {AnalyserNode} analyser - Web Audio API analyser node
 * @param {Function} callback - Function to call with audio level
 * @param {boolean} isActive - Whether visualization should continue
 * @returns {Function} Function to stop visualization
 */
export function startVisualization(analyser, callback, isActive = true) {
  if (!analyser || !callback) {
    return () => {};
  }
  
  let animationFrame;
  let active = isActive;
  
  const updateLevel = () => {
    if (!active || !analyser) {
      return;
    }
    
    const level = getAudioLevel(analyser);
    callback(level);
    
    animationFrame = requestAnimationFrame(updateLevel);
  };
  
  updateLevel();
  
  // Return stop function
  return () => {
    active = false;
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  };
}

/**
 * Get available audio input devices
 * 
 * @returns {Promise<Array>} Promise resolving to array of audio input devices
 */
export async function getAudioInputDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    
    return [
      { id: 'default', label: 'Default Microphone' },
      ...audioInputs.map(device => ({
        id: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.substring(0, 5)}...`
      }))
    ];
  } catch (error) {
    console.error('Error getting audio devices:', error);
    return [{ id: 'default', label: 'Default Microphone' }];
  }
}

/**
 * Request access to user's microphone with specific constraints
 * 
 * @param {string} deviceId - ID of the audio device to use
 * @returns {Promise<MediaStream>} Promise resolving to MediaStream object
 */
export async function getMicrophoneStream(deviceId = 'default') {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId !== 'default' ? { exact: deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
  } catch (error) {
    console.error('Error accessing microphone:', error);
    throw error;
  }
}

/**
 * Convert audio buffer to MP3 format for streaming
 * 
 * @param {AudioBuffer} audioBuffer - Web Audio API buffer
 * @param {number} sampleRate - Target sample rate for MP3
 * @returns {Promise<Blob>} Promise resolving to MP3 blob
 */
export async function convertToMP3(audioBuffer, sampleRate = 44100) {
  // This is a stub - actual MP3 encoding would be implemented
  // using a library like lamejs or being handled on the server
  console.warn('MP3 encoding not implemented in this utility');
  return new Blob();
} 