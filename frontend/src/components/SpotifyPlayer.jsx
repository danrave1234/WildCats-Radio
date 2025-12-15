import React, { useState, useEffect } from 'react';
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowPathIcon,
  MusicalNoteIcon
} from '@heroicons/react/24/solid';
import { useStreaming } from '../context/StreamingContext';
import { broadcastService } from '../services/api/index.js';

const SpotifyPlayer = ({ broadcast: propBroadcast, currentDJ }) => {
  const {
    isLive: streamingIsLive,
    currentBroadcast: streamingCurrentBroadcast,
    audioPlaying,
    volume,
    isMuted,
    listenerCount,
    isStreamSyncing,
    toggleAudio,
    updateVolume,
    toggleMute,
    refreshStream
  } = useStreaming();

  // Use prop broadcast if provided, otherwise use streaming context broadcast, otherwise use internal state
  const currentBroadcast = propBroadcast || streamingCurrentBroadcast;
  const isLive = propBroadcast ? (propBroadcast.status === 'LIVE') : streamingIsLive;

  const [internalCurrentBroadcast, setInternalCurrentBroadcast] = useState(null);
  const [currentTrack, setCurrentTrack] = useState({
    title: 'No songs played',
    artist: 'WildCat Radio',
    album: 'Live Stream'
  });

  const [isLoading, setIsLoading] = useState(false);

  const fetchCurrentBroadcast = async () => {
    try {
      const activeBroadcast = await broadcastService.getActiveBroadcast();
      if (activeBroadcast) {
        setInternalCurrentBroadcast(activeBroadcast);
        return;
      }

      const liveResponse = await broadcastService.getLive();
      if (liveResponse.data && liveResponse.data.length > 0) {
        setInternalCurrentBroadcast(liveResponse.data[0]);
        return;
      }

      setInternalCurrentBroadcast(null);
    } catch (error) {
      console.error('Error fetching broadcast:', error);
    }
  };

  useEffect(() => {
    if (isLive) {
      fetchCurrentBroadcast();
    } else {
      setInternalCurrentBroadcast(null);
    }
  }, [isLive]);


  useEffect(() => {
    if (currentBroadcast) {
      setCurrentTrack({
        title: 'No songs played',
        artist: 'WildCat Radio',
        album: 'Live Stream'
      });
    } else {
      setCurrentTrack({
        title: 'No songs played',
        artist: 'WildCat Radio',
        album: 'Live Stream'
      });
    }
  }, [currentBroadcast]);

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value, 10);
    updateVolume(newVolume);
  };

  const handleMuteToggle = () => {
    toggleMute();
  };

  const handlePlayPause = () => {
    setIsLoading(true);
    toggleAudio();
    setTimeout(() => setIsLoading(false), 500);
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchCurrentBroadcast();
    refreshStream();
    setTimeout(() => setIsLoading(false), 1000);
  };

  const getAlbumCoverGradient = () => {
    const title = currentTrack.title || 'No songs played';
    const hash = title.split('').reduce((acc, ch) => {
      const code = ch.charCodeAt(0);
      const next = ((acc << 5) - acc) + code;
      return next & next;
    }, 0);
    const hue = Math.abs(hash) % 360;
    const nextHue = (hue + 30) % 360;
    return `linear-gradient(135deg, hsl(${hue}, 70%, 60%), hsl(${nextHue}, 70%, 40%))`;
  };

  if (!isLive) {
    return (
      <div className="rounded-xl shadow-lg overflow-hidden relative bg-maroon-700 dark:bg-maroon-800 border border-maroon-800/50 dark:border-maroon-900/50">
        <div className="p-3 sm:p-5 text-center relative">
          <div className="relative">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 rounded-xl flex items-center justify-center bg-maroon-900/40 backdrop-blur-sm border-2 border-maroon-600/30">
              <MusicalNoteIcon className="h-8 w-8 sm:h-10 sm:w-10 text-gold-500" />
            </div>
            <h3 className="text-base sm:text-xl font-bold mb-1.5 sm:mb-2 text-white font-poppins">WildCats Radio</h3>
            <p className="text-white/80 text-xs sm:text-sm">No broadcast currently active</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl shadow-lg overflow-hidden relative bg-maroon-700 dark:bg-maroon-800 border border-maroon-800/50 dark:border-maroon-900/50">
      <div className="p-3 sm:p-5 relative">
        <div className="relative">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-red-600 rounded-full px-2 sm:px-3 py-0.5 sm:py-1 shadow-md border border-red-500">
                <span className="h-1.5 sm:h-2 w-1.5 sm:w-2 rounded-full bg-white animate-pulse mr-1.5 sm:mr-2"></span>
                <span className="text-white text-[10px] sm:text-xs font-bold tracking-wide">
                  LIVE ({listenerCount} listener{listenerCount !== 1 ? 's' : ''})
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/90 text-[9px] sm:text-[10px] font-semibold tracking-wide uppercase">WildCat Radio</p>
            </div>
          </div>

          <div className="mb-2 sm:mb-4">
            <h2 className="text-white text-base sm:text-xl font-bold mb-1 sm:mb-1.5 truncate font-poppins">
              {currentBroadcast?.title || 'Live Broadcast'}
            </h2>

            {/* Enhanced DJ Display */}
            {currentDJ && (
              <div className="flex items-center mb-1 sm:mb-2">
                <span className="text-gold-400 text-xs sm:text-sm font-semibold">
                  Hosted by: {(() => {
                    // Priority: firstname + lastname → name → email
                    if (currentDJ.firstname && currentDJ.lastname) {
                      return `${currentDJ.firstname} ${currentDJ.lastname}`;
                    }
                    if (currentDJ.name) {
                      return currentDJ.name;
                    }
                    return currentDJ.email || 'Unknown DJ';
                  })()}
                </span>
              </div>
            )}

            {currentBroadcast?.description && (
              <p className="text-white/80 text-[10px] sm:text-xs leading-relaxed max-w-2xl line-clamp-2">
                {currentBroadcast.description}
              </p>
            )}
          </div>



          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <button
                onClick={handlePlayPause}
                disabled={isLoading || isStreamSyncing}
                className="w-10 h-10 sm:w-12 sm:h-12 bg-gold-500 hover:bg-gold-600 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-50 shadow-lg hover:shadow-xl hover:scale-105 border-2 border-gold-400"
              >
                {isStreamSyncing ? (
                  <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-2 border-maroon-900 border-t-transparent"></div>
                ) : isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-2 border-maroon-900 border-t-transparent"></div>
                ) : audioPlaying ? (
                  <PauseIcon className="h-5 w-5 sm:h-6 sm:w-6 text-maroon-900" />
                ) : (
                  <PlayIcon className="h-5 w-5 sm:h-6 sm:w-6 text-maroon-900 ml-0.5" />
                )}
              </button>

              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="w-8 h-8 sm:w-10 sm:h-10 bg-maroon-800/60 hover:bg-maroon-800/80 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-50 hover:scale-105 border border-maroon-700/50"
              >
                <ArrowPathIcon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-white ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-3">
              <button
                onClick={handleMuteToggle}
                className="w-8 h-8 sm:w-9 sm:h-9 bg-maroon-800/60 hover:bg-maroon-800/80 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 border border-maroon-700/50"
              >
                {isMuted ? (
                  <SpeakerXMarkIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                ) : (
                  <SpeakerWaveIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                )}
              </button>

              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 sm:w-20 h-1 sm:h-1.5 bg-maroon-900/50 rounded-lg appearance-none cursor-pointer accent-gold-500"
                />
                <span className="text-white text-[10px] sm:text-xs font-semibold min-w-[2rem] sm:min-w-[2.5rem] text-right">
                  {isMuted ? '0%' : `${volume}%`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpotifyPlayer;
