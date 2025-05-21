import React, { useState, useRef, useEffect } from 'react';
import { streamService } from '../services/api';

const AudioPlayer = ({ className }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [streamUrl, setStreamUrl] = useState('');
  const [metadata, setMetadata] = useState({ title: 'WildCats Radio', artist: 'No broadcast' });
  const [volume, setVolume] = useState(80);
  const [isLive, setIsLive] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [error, setError] = useState(null);
  
  const audioRef = useRef(null);
  const statusTimer = useRef(null);
  
  // Load stream status on mount
  useEffect(() => {
    checkStreamStatus();
    
    // Set up polling for stream status
    statusTimer.current = setInterval(checkStreamStatus, 10000);
    
    return () => {
      if (statusTimer.current) {
        clearInterval(statusTimer.current);
      }
    };
  }, []);
  
  // Update audio element when stream URL changes
  useEffect(() => {
    if (streamUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.src = streamUrl;
        audioRef.current.load();
        audioRef.current.play().catch(error => {
          console.error('Error playing audio:', error);
          setError('Could not play audio. Please try again.');
          setIsPlaying(false);
        });
      }
    }
  }, [streamUrl, isPlaying]);
  
  // Update volume when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);
  
  // Check if there's an active stream
  const checkStreamStatus = async () => {
    try {
      const response = await streamService.getStatus();
      const status = response.data;
      
      setIsLive(status.live === true);
      setHasAudio(status.streaming === true);
      
      if (status.live) {
        setStreamUrl(status.streamUrl);
        
        if (status.metadata) {
          setMetadata({
            title: status.metadata.title || 'Live Broadcast',
            artist: status.metadata.artist || 'WildCats Radio'
          });
        } else if (status.broadcast) {
          setMetadata({
            title: status.broadcast.title || 'Live Broadcast',
            artist: status.broadcast.dj || 'WildCats Radio'
          });
        }
        
        // Auto-play if we were previously playing and the stream is available
        if (isPlaying && audioRef.current && status.streaming) {
          audioRef.current.src = status.streamUrl;
          audioRef.current.load();
          audioRef.current.play().catch(error => {
            console.error('Error auto-playing audio:', error);
          });
        }
      } else {
        // No live broadcast
        setMetadata({
          title: 'WildCats Radio',
          artist: 'No broadcast'
        });
        
        if (isPlaying) {
          handleStop();
        }
      }
    } catch (error) {
      console.error('Error checking stream status:', error);
      setError('Could not connect to radio server');
      
      // Retry connection if we were playing
      if (isPlaying && streamUrl) {
        audioRef.current.src = streamUrl;
        audioRef.current.load();
        audioRef.current.play().catch(() => {
          setIsPlaying(false);
        });
      }
    }
  };
  
  // Handle play button click
  const handlePlay = () => {
    setIsLoading(true);
    setError(null);
    
    if (!streamUrl) {
      // If we don't have a stream URL yet, get it from the API
      streamService.getStatus()
        .then(response => {
          const status = response.data;
          if (status.live && status.streamUrl) {
            setStreamUrl(status.streamUrl);
            playAudio(status.streamUrl);
          } else {
            setError('No live broadcast available');
            setIsLoading(false);
          }
        })
        .catch(error => {
          console.error('Error getting stream URL:', error);
          setError('Could not connect to radio server');
          setIsLoading(false);
        });
    } else {
      // We already have a stream URL
      playAudio(streamUrl);
    }
  };
  
  // Play audio with the given URL
  const playAudio = (url) => {
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.load();
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsLoading(false);
          })
          .catch(error => {
            console.error('Error playing audio:', error);
            setError('Could not play audio. Please try again.');
            setIsPlaying(false);
            setIsLoading(false);
          });
      }
    }
  };
  
  // Handle stop button click
  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };
  
  // Handle volume change
  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value, 10);
    setVolume(newVolume);
  };
  
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 ${className}`}>
      <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Now Playing</h2>
      
      {/* Audio Element (Hidden) */}
      <audio ref={audioRef} preload="none">
        <source src={streamUrl} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
      
      {/* Metadata Display */}
      <div className="mb-4">
        <div className="text-lg font-medium text-primary-600 dark:text-primary-400 truncate">
          {metadata.title}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
          {metadata.artist}
        </div>
      </div>
      
      {/* Live Indicator */}
      {isLive && (
        <div className="flex items-center mb-4">
          <span className="inline-flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <span className="ml-2 text-sm font-medium text-red-500">LIVE</span>
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md text-sm">
          {error}
        </div>
      )}
      
      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        {/* Play/Stop Button */}
        <button
          disabled={!isLive || isLoading}
          onClick={isPlaying ? handleStop : handlePlay}
          className={`w-12 h-12 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            isLive ? 'bg-primary-500 hover:bg-primary-600 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : isPlaying ? (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          )}
        </button>
        
        {/* Volume Control */}
        <div className="flex items-center ml-4 flex-1">
          <svg className="h-4 w-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
          </svg>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={handleVolumeChange}
            className="ml-2 flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
      
      {/* Stream Status */}
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
        {!isLive ? (
          'No broadcast currently in progress'
        ) : isPlaying ? (
          'Streaming live radio'
        ) : (
          'Ready to play'
        )}
      </div>
    </div>
  );
};

export default AudioPlayer; 