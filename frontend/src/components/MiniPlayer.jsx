import React from 'react';
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStreaming } from '../context/StreamingContext';

const MiniPlayer = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { audioPlaying, toggleAudio, currentBroadcast, isLive } = useStreaming();

  // Hide on listener dashboard views
  if (location.pathname === '/dashboard' || location.pathname.startsWith('/broadcast')) {
    return null;
  }

  // Only show if there's an active broadcast or playback
  if (!isLive && !audioPlaying) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-maroon-800 text-white z-50 flex items-center justify-between px-4 py-2 shadow-lg">
      <div className="flex items-center space-x-2">
        <span className="font-medium truncate max-w-[50vw]">
          {currentBroadcast?.title || 'Live Broadcast'}
        </span>
        {isLive && (
          <span className="text-xs bg-red-600 rounded px-2 py-0.5">LIVE</span>
        )}
      </div>
      <div className="flex items-center space-x-4">
        <button
          onClick={toggleAudio}
          className="p-2 rounded-full bg-white/20 hover:bg-white/30"
        >
          {audioPlaying ? (
            <PauseIcon className="h-5 w-5" />
          ) : (
            <PlayIcon className="h-5 w-5" />
          )}
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-xs underline"
        >
          Open Player
        </button>
      </div>
    </div>
  );
};

export default MiniPlayer;
