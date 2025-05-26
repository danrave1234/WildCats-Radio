import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  XMarkIcon,
  RadioIcon
} from '@heroicons/react/24/solid';
import { useAudioStream } from '../context/AudioStreamContext';

const PersistentStreamBar = () => {
  const navigate = useNavigate();
  const {
    isPlaying,
    isMuted,
    volume,
    isStreamBarVisible,
    currentStream,
    streamError,
    togglePlayback,
    toggleMute,
    handleVolumeChange,
    hideStreamBar,
    stopStream
  } = useAudioStream();

  // Don't render if not visible or no current stream
  if (!isStreamBarVisible || !currentStream) {
    return null;
  }

  const handleNavigateToDashboard = () => {
    navigate('/dashboard');
  };

  const handleVolumeSliderChange = (e) => {
    const newVolume = parseInt(e.target.value, 10);
    handleVolumeChange(newVolume);
  };

  const handleStopStream = () => {
    stopStream();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white shadow-lg border-b border-red-700">
      <div className="flex items-center justify-between px-4 py-2 max-w-7xl mx-auto">
        {/* Left side - Stream info and controls */}
        <div className="flex items-center space-x-4">
          {/* Radio icon */}
          <div className="flex items-center space-x-2">
            <RadioIcon className="h-5 w-5 text-white animate-pulse" />
            <span className="text-sm font-medium">
              {isPlaying ? 'Now Playing' : 'Stream Ready'}
            </span>
          </div>

          {/* Stream title - clickable to navigate to dashboard */}
          <button
            onClick={handleNavigateToDashboard}
            className="text-white hover:text-red-200 transition-colors cursor-pointer flex items-center space-x-2 bg-red-700 hover:bg-red-800 px-3 py-1 rounded-md"
            title="Go to Dashboard"
          >
            <span className="text-sm font-semibold truncate max-w-xs">
              {currentStream.title || 'WildCats Radio Live'}
            </span>
          </button>

          {/* Play/Pause button */}
          <button
            onClick={togglePlayback}
            className="p-1 hover:bg-red-700 rounded-full transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <PauseIcon className="h-5 w-5" />
            ) : (
              <PlayIcon className="h-5 w-5" />
            )}
          </button>

          {/* Volume controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleMute}
              className="p-1 hover:bg-red-700 rounded-full transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <SpeakerXMarkIcon className="h-5 w-5" />
              ) : (
                <SpeakerWaveIcon className="h-5 w-5" />
              )}
            </button>

            {/* Volume slider */}
            <div className="hidden sm:flex items-center space-x-2">
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeSliderChange}
                className="w-16 h-1 bg-red-800 rounded-lg appearance-none cursor-pointer slider-thumb"
                title={`Volume: ${isMuted ? 0 : volume}%`}
              />
              <span className="text-xs w-8 text-center">
                {isMuted ? 0 : volume}%
              </span>
            </div>
          </div>
        </div>

        {/* Center - Stream status or error */}
        <div className="flex-1 flex justify-center">
          {streamError ? (
            <span className="text-xs text-red-200 truncate max-w-md">
              ⚠️ {streamError}
            </span>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-1 h-4 bg-white rounded-full animate-pulse"></div>
                <div className="w-1 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
              <span className="text-xs font-medium">
                Live Stream
              </span>
            </div>
          )}
        </div>

        {/* Right side - Close buttons */}
        <div className="flex items-center space-x-2">
          {/* Minimize (hide) button */}
          <button
            onClick={hideStreamBar}
            className="p-1 hover:bg-red-700 rounded-full transition-colors"
            title="Hide stream bar (stream continues playing)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Stop stream button */}
          <button
            onClick={handleStopStream}
            className="p-1 hover:bg-red-700 rounded-full transition-colors"
            title="Stop stream"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Custom CSS for volume slider */}
      <style jsx>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }

        .slider-thumb::-moz-range-thumb {
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }

        .slider-thumb::-webkit-slider-track {
          background: rgba(220, 38, 38, 0.8);
          height: 4px;
          border-radius: 2px;
        }

        .slider-thumb::-moz-range-track {
          background: rgba(220, 38, 38, 0.8);
          height: 4px;
          border-radius: 2px;
          border: none;
        }
      `}</style>
    </div>
  );
};

export default PersistentStreamBar; 