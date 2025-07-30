import React from 'react';
import { 
  ComputerDesktopIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useStreaming } from '../context/StreamingContext';

const DJAudioControls = () => {
  const { 
    isLive, 
    audioSource,
    audioStreamRef,
    mediaRecorderRef
  } = useStreaming();

  if (!isLive) {
    return null; // Only show during live broadcast
  }

  // Check if audio is currently streaming
  const isAudioStreaming = mediaRecorderRef.current && 
                          audioStreamRef.current && 
                          mediaRecorderRef.current.state === 'recording';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
          <ComputerDesktopIcon className="h-4 w-4 mr-2" />
          Audio Source Status
        </h3>
      </div>

      <div className="space-y-4">
        {/* Audio Source Display */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Current Source</span>
            <div className="flex items-center space-x-2">
              <ComputerDesktopIcon className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">Desktop Audio</span>
            </div>
          </div>
          
          {/* Audio Status Indicator */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Streaming Status</span>
            <div className="flex items-center space-x-2">
              {isAudioStreaming ? (
                <>
                  <CheckCircleIcon className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600 dark:text-green-400">Active</span>
                </>
              ) : (
                <>
                  <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-600 dark:text-yellow-400">Disconnected</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Information Panel */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          <div className="text-xs text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">Audio Controls</p>
            <p>Volume, mixing, and audio processing are handled by your third-party DJ software.</p>
            <p className="mt-1">This panel shows the connection status to your desktop audio source.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DJAudioControls; 