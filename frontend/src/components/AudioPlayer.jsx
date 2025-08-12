import React, { useState, useEffect } from 'react';
import { 
  PlayIcon, 
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/solid';
import { useStreaming } from '../context/StreamingContext';

const AudioPlayer = ({ isPreview = false }) => {
  const { 
    isLive, 
    currentBroadcast, 
    audioPlaying, 
    volume, 
    isMuted,
    listenerCount,
    toggleAudio, 
    updateVolume, 
    toggleMute,
    refreshStream
  } = useStreaming();

  const [currentTrack, setCurrentTrack] = useState({
    title: 'No track information available',
    artist: 'Unknown Artist'
  });

  // Simulate track information updates
  useEffect(() => {
    if ((isLive || isPreview) && currentBroadcast) {
      // In a real implementation, this would come from the streaming service
      // For now, we'll show the broadcast title as the track
      setCurrentTrack({
        title: currentBroadcast.title || 'Live Broadcast',
        artist: currentBroadcast.dj?.name || 'WildCat Radio'
      });
    } else {
      setCurrentTrack({
        title: 'No track information available',
        artist: 'Unknown Artist'
      });
    }
  }, [isLive, isPreview, currentBroadcast]);

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value, 10);
    updateVolume(newVolume);
  };

  const handleMuteToggle = () => {
    toggleMute();
  };

  const handlePlayPause = () => {
    toggleAudio();
  };

  const handleRefresh = () => {
    refreshStream();
  };

  // Show in preview mode or when live
  if (!isLive && !isPreview) {
    return null;
  }

  return (
    <div className="bg-maroon-600 rounded-lg shadow-lg overflow-hidden">
      <div className="p-6">
        {/* Live Status Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-red-600 rounded-full px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse mr-2"></span>
              <span className="text-white text-sm font-semibold">
                {isLive ? `LIVE (${listenerCount} listener${listenerCount !== 1 ? 's' : ''})` : 'PREVIEW'}
              </span>
            </div>
          </div>
          {/* WildCat Radio branding in top right */}
          <div className="text-right">
            <p className="text-maroon-100 text-xs font-medium">WildCat Radio</p>
          </div>
        </div>

        {/* Broadcast Title and Description - Primary Information */}
        <div className="mb-6">
          <h2 className="text-white text-2xl font-bold mb-2 truncate">
            {currentBroadcast?.title || 'Live Broadcast'}
          </h2>
          <p className="text-maroon-100 text-base mb-3">
            {currentBroadcast?.dj?.name || currentBroadcast?.host?.name || 'Live Stream'}
          </p>
          {currentBroadcast?.description && (
            <p className="text-maroon-200 text-sm leading-relaxed">
              {currentBroadcast.description}
            </p>
          )}
        </div>

        {/* Album Cover and Song Info - Secondary Information */}
        <div className="flex items-start space-x-4 mb-6">
          {/* Album Cover */}
          <div 
            className="w-20 h-20 rounded-lg shadow-lg flex items-center justify-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, hsl(45, 70%, 60%), hsl(45, 70%, 40%))' }}
          >
            <svg className="h-10 w-10 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.369 4.369 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/>
            </svg>
            {/* Play/Pause overlay */}
            <button
              onClick={handlePlayPause}
              className="absolute inset-0 bg-black bg-opacity-30 hover:bg-opacity-50 flex items-center justify-center transition-all duration-200 opacity-0 hover:opacity-100"
            >
              {audioPlaying ? (
                <PauseIcon className="h-6 w-6 text-white" />
              ) : (
                <PlayIcon className="h-6 w-6 text-white ml-1" />
              )}
            </button>
          </div>

          {/* Song Information - Secondary */}
          <div className="flex-1 min-w-0">
            <div className="mb-2">
              <p className="text-maroon-100 text-xs font-medium uppercase tracking-wide mb-1">
                NOW PLAYING
              </p>
              <div className="bg-maroon-700 rounded-lg p-3">
                <p className="text-white text-sm font-medium truncate">
                  {currentTrack.title}
                </p>
                <p className="text-maroon-200 text-xs truncate">
                  {currentTrack.artist}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Play/Pause Button */}
            <button
              onClick={handlePlayPause}
              className="w-12 h-12 bg-gold-500 hover:bg-gold-600 rounded-full flex items-center justify-center transition-all duration-200"
            >
              {audioPlaying ? (
                <PauseIcon className="h-6 w-6 text-white" />
              ) : (
                <PlayIcon className="h-6 w-6 text-white ml-1" />
              )}
            </button>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              className="w-10 h-10 bg-maroon-700 hover:bg-maroon-600 rounded-full flex items-center justify-center transition-all duration-200"
            >
              <ArrowPathIcon className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Volume Controls */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleMuteToggle}
              className="w-8 h-8 bg-maroon-700 hover:bg-maroon-600 rounded-full flex items-center justify-center transition-all duration-200"
            >
              {isMuted ? (
                <SpeakerXMarkIcon className="h-4 w-4 text-white" />
              ) : (
                <SpeakerWaveIcon className="h-4 w-4 text-white" />
              )}
            </button>
            
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-maroon-700 rounded-lg appearance-none cursor-pointer accent-gold-500"
              />
              <span className="text-white text-sm font-medium min-w-[3rem] text-right">
                {isMuted ? '0%' : `${volume}%`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer; 