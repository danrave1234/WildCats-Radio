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
import { brandingApi } from '../services/api/brandingApi';

const SpotifyPlayer = () => {
  const {
    isLive,
    currentBroadcast: streamingBroadcast,
    audioPlaying,
    volume,
    isMuted,
    listenerCount,
    toggleAudio,
    updateVolume,
    toggleMute,
    refreshStream
  } = useStreaming();

  const [currentBroadcast, setCurrentBroadcast] = useState(null);
  const [currentTrack, setCurrentTrack] = useState({
    title: 'No songs played',
    artist: 'WildCat Radio',
    album: 'Live Stream'
  });

  const [bannerUrl, setBannerUrl] = useState(null);
  const [isDarkBanner, setIsDarkBanner] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCurrentBroadcast = async () => {
    try {
      const activeBroadcast = await broadcastService.getActiveBroadcast();
      if (activeBroadcast) {
        setCurrentBroadcast(activeBroadcast);
        return;
      }

      const liveResponse = await broadcastService.getLive();
      if (liveResponse.data && liveResponse.data.length > 0) {
        setCurrentBroadcast(liveResponse.data[0]);
        return;
      }

      setCurrentBroadcast(null);
    } catch (error) {
      console.error('Error fetching broadcast:', error);
    }
  };

  useEffect(() => {
    if (isLive) {
      fetchCurrentBroadcast();
    } else {
      setCurrentBroadcast(null);
    }
  }, [isLive]);

  useEffect(() => {
    const loadBanner = async () => {
      try {
        const res = await brandingApi.getBanner();
        const url = res?.data?.url || null;
        setBannerUrl(url);
        if (url) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const w = 32;
              const h = 32;
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(img, 0, 0, w, h);
              const data = ctx.getImageData(0, 0, w, h).data;
              let r = 0;
              let g = 0;
              let b = 0;
              let count = 0;
              for (let i = 0; i < data.length; i += 4) {
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
                count++;
              }
              r /= count;
              g /= count;
              b /= count;
              const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
              setIsDarkBanner(lum < 0.6);
            } catch (_e) {
              setIsDarkBanner(true);
            }
          };
          img.src = url;
        }
      } catch (_e) {
        setBannerUrl(null);
      }
    };
    loadBanner();
  }, []);

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
    const textMain = isDarkBanner ? 'text-white' : 'text-slate-900';
    const textSub = isDarkBanner ? 'text-white/80' : 'text-slate-600';
    return (
      <div
        className="rounded-xl shadow-lg overflow-hidden relative bg-maroon-700 dark:bg-maroon-800 border border-maroon-800/50 dark:border-maroon-900/50"
        style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >
        <div className="p-5 text-center relative">
          {bannerUrl && <div className="absolute inset-0 bg-maroon-900/60" aria-hidden="true"></div>}
          <div className="relative">
            <div className="w-20 h-20 mx-auto mb-4 rounded-xl flex items-center justify-center bg-maroon-900/40 backdrop-blur-sm border-2 border-maroon-600/30">
              <MusicalNoteIcon className="h-10 w-10 text-gold-500" />
            </div>
            <h3 className={`text-xl font-bold mb-2 ${textMain} font-montserrat`}>WildCats Radio</h3>
            <p className={`${textSub} text-sm`}>No broadcast currently active</p>
          </div>
        </div>
      </div>
    );
  }

  const textMain = isDarkBanner ? 'text-white' : 'text-slate-900';
  const textMuted = isDarkBanner ? 'text-white/80' : 'text-slate-600';

  return (
    <div
      className="rounded-xl shadow-lg overflow-hidden relative bg-maroon-700 dark:bg-maroon-800 border border-maroon-800/50 dark:border-maroon-900/50"
      style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
    >
      <div className="p-5 relative">
        {bannerUrl && <div className="absolute inset-0 bg-maroon-900/50" aria-hidden="true"></div>}
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-red-600 rounded-full px-3 py-1 shadow-md border border-red-500">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse mr-2"></span>
                <span className="text-white text-xs font-bold tracking-wide">
                  LIVE ({listenerCount} listener{listenerCount !== 1 ? 's' : ''})
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/90 text-[10px] font-semibold tracking-wide uppercase">WildCat Radio</p>
            </div>
          </div>

          <div className="mb-4">
            <h2 className={`${textMain} text-xl font-bold mb-1.5 truncate font-montserrat`}>
              {currentBroadcast?.title || 'Live Broadcast'}
            </h2>
            <p className={`${textMuted} text-sm mb-2 font-medium`}>
              {currentBroadcast?.dj?.name || currentBroadcast?.host?.name || 'Live Stream'}
            </p>
            {currentBroadcast?.description && (
              <p className={`${textMuted} text-xs leading-relaxed max-w-2xl line-clamp-2`}>
                {currentBroadcast.description}
              </p>
            )}
          </div>

          <div className="flex items-start space-x-3 mb-4">
            <div
              className="w-16 h-16 rounded-lg shadow-lg flex items-center justify-center relative overflow-hidden bg-maroon-900/50 border-2 border-maroon-600/30 hover:border-gold-500/50 transition-all duration-300 flex-shrink-0"
              style={currentTrack.title !== 'No songs played' ? { background: getAlbumCoverGradient() } : {}}
            >
              <MusicalNoteIcon className="h-8 w-8 text-gold-500" />
              <button
                onClick={handlePlayPause}
                disabled={isLoading}
                className="absolute inset-0 bg-black/40 hover:bg-black/50 flex items-center justify-center transition-all duration-200 opacity-0 hover:opacity-100"
              >
                {audioPlaying ? (
                  <PauseIcon className="h-5 w-5 text-white" />
                ) : (
                  <PlayIcon className="h-5 w-5 text-white ml-0.5" />
                )}
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <div className="mb-2">
                <p className={`${textMuted} text-[10px] font-bold uppercase tracking-wider mb-1.5`}>
                  NOW PLAYING
                </p>
                <div className="bg-maroon-900/40 backdrop-blur-sm rounded-lg p-2.5 border border-maroon-700/30">
                  <p className={`${textMain} text-sm font-semibold truncate mb-0.5`}>
                    {currentTrack.title}
                  </p>
                  <p className={`${textMuted} text-xs truncate`}>
                    {currentTrack.artist}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={handlePlayPause}
                disabled={isLoading}
                className="w-12 h-12 bg-gold-500 hover:bg-gold-600 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-50 shadow-lg hover:shadow-xl hover:scale-105 border-2 border-gold-400"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-maroon-900 border-t-transparent"></div>
                ) : audioPlaying ? (
                  <PauseIcon className="h-6 w-6 text-maroon-900" />
                ) : (
                  <PlayIcon className="h-6 w-6 text-maroon-900 ml-0.5" />
                )}
              </button>

              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="w-10 h-10 bg-maroon-800/60 hover:bg-maroon-800/80 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-50 hover:scale-105 border border-maroon-700/50"
              >
                <ArrowPathIcon className={`h-4 w-4 text-white ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleMuteToggle}
                className="w-9 h-9 bg-maroon-800/60 hover:bg-maroon-800/80 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 border border-maroon-700/50"
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
                  className="w-20 h-1.5 bg-maroon-900/50 rounded-lg appearance-none cursor-pointer accent-gold-500"
                />
                <span className={`${textMain} text-xs font-semibold min-w-[2.5rem] text-right`}>
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
