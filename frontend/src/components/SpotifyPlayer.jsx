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
    const textMain = isDarkBanner ? 'text-white' : 'text-gray-900';
    const textSub = isDarkBanner ? 'text-maroon-100' : 'text-gray-600';
    return (
      <div
        className="rounded-lg shadow-lg overflow-hidden relative"
        style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { backgroundColor: '#91403E' }}
      >
        <div className="p-6 text-center relative">
          {bannerUrl && <div className="absolute inset-0 bg-black/35" aria-hidden="true"></div>}
          <div className="relative">
            <div className="w-32 h-32 mx-auto mb-4 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.25)' }}>
              <MusicalNoteIcon className="h-16 w-16 text-white" />
            </div>
            <h3 className={`text-xl font-bold mb-2 ${textMain}`}>WildCats Radio</h3>
            <p className={textSub}>No broadcast currently active</p>
          </div>
        </div>
      </div>
    );
  }

  const textMain = isDarkBanner ? 'text-white' : 'text-gray-900';
  const textMuted = isDarkBanner ? 'text-maroon-100' : 'text-gray-600';

  return (
    <div
      className="rounded-lg shadow-lg overflow-hidden relative"
      style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { backgroundColor: '#91403E' }}
    >
      <div className="p-6 relative">
        {bannerUrl && <div className="absolute inset-0 bg-black/30" aria-hidden="true"></div>}
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="flex items-center bg-red-600 rounded-full px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse mr-2"></span>
                <span className="text-white text-sm font-semibold">
                  LIVE ({listenerCount} listener{listenerCount !== 1 ? 's' : ''})
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-maroon-100 text-xs font-medium">WildCat Radio</p>
            </div>
          </div>

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

          <div className="flex items-start space-x-4 mb-6">
            <div
              className="w-20 h-20 rounded-lg shadow-lg flex items-center justify-center relative overflow-hidden"
              style={{ background: getAlbumCoverGradient() }}
            >
              <MusicalNoteIcon className="h-10 w-10 text-white" />
              <button
                onClick={handlePlayPause}
                disabled={isLoading}
                className="absolute inset-0 bg-black bg-opacity-30 hover:bg-opacity-50 flex items-center justify-center transition-all duration-200 opacity-0 hover:opacity-100"
              >
                {audioPlaying ? (
                  <PauseIcon className="h-6 w-6 text-white" />
                ) : (
                  <PlayIcon className="h-6 w-6 text-white ml-1" />
                )}
              </button>
            </div>

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

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handlePlayPause}
                disabled={isLoading}
                className="w-12 h-12 bg-gold-500 hover:bg-gold-600 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : audioPlaying ? (
                  <PauseIcon className="h-6 w-6 text-white" />
                ) : (
                  <PlayIcon className="h-6 w-6 text-white ml-1" />
                )}
              </button>

              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="w-10 h-10 bg-maroon-700 hover:bg-maroon-600 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-50"
              >
                <ArrowPathIcon className="h-5 w-5 text-white" />
              </button>
            </div>

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
    </div>
  );
};

export default SpotifyPlayer;
