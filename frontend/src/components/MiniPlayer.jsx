import React from 'react';
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStreaming } from '../context/StreamingContext';
import { useAuth } from '../context/AuthContext';

const MiniPlayer = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { audioPlaying, toggleAudio, currentBroadcast, isLive } = useStreaming();

  // Hide on listener dashboard views
  if (location.pathname === '/dashboard' || location.pathname.startsWith('/broadcast')) {
    return null;
  }

  // Only listeners should see the mini player
  if (currentUser?.role !== 'LISTENER') {
    return null;
  }

  // Only show if there's an active broadcast
  if (!isLive) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-maroon-700 via-maroon-800 to-maroon-700 text-white z-50 flex items-center justify-between px-4 py-2 shadow-xl border-t border-maroon-900">
      <div className="flex items-center space-x-3 overflow-hidden">
        <span className="font-semibold truncate max-w-[60vw]">
          {currentBroadcast?.title || 'Live Broadcast'}
        </span>
        {isLive && (
          <span className="text-xs bg-red-600 rounded px-2 py-0.5 animate-pulse">LIVE</span>
        )}
      </div>
      <div className="flex items-center space-x-4">
        <button
          onClick={toggleAudio}
          className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition"
        >
          {audioPlaying ? (
            <PauseIcon className="h-5 w-5" />
          ) : (
            <PlayIcon className="h-5 w-5" />
          )}
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-xs underline hover:text-gray-200"
        >
          Open Player
        </button>
      </div>
    </div>
  );
};

export default MiniPlayer;
