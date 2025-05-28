import React, { useState, useEffect } from 'react';
import { MicrophoneIcon, ComputerDesktopIcon, SpeakerWaveIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useStreaming } from '../context/StreamingContext';

const AudioSourceSelector = ({ disabled = false }) => {
  const { audioSource, setAudioSource, isLive } = useStreaming();
  const [browserSupport, setBrowserSupport] = useState({
    microphone: true,
    desktop: true,
    both: true
  });

  // Check browser support on component mount
  useEffect(() => {
    const checkBrowserSupport = () => {
      const support = {
        microphone: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        desktop: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && window.isSecureContext),
        both: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && navigator.mediaDevices.getDisplayMedia && window.isSecureContext)
      };
      setBrowserSupport(support);
    };

    checkBrowserSupport();
  }, []);

  const audioSources = [
    {
      id: 'microphone',
      name: 'Microphone Only',
      description: 'Capture audio from your microphone',
      icon: MicrophoneIcon,
      color: 'bg-blue-100 text-blue-600 border-blue-200 hover:bg-blue-200',
      supported: browserSupport.microphone
    },
    {
      id: 'desktop',
      name: 'Desktop Audio',
      description: 'Capture system audio (music, apps, etc.)',
      icon: ComputerDesktopIcon,
      color: 'bg-green-100 text-green-600 border-green-200 hover:bg-green-200',
      supported: browserSupport.desktop
    },
    {
      id: 'both',
      name: 'Microphone + Desktop',
      description: 'Mix microphone and system audio',
      icon: SpeakerWaveIcon,
      color: 'bg-purple-100 text-purple-600 border-purple-200 hover:bg-purple-200',
      supported: browserSupport.both
    }
  ];

  const handleSourceChange = (sourceId) => {
    if (!disabled && !isLive) {
      setAudioSource(sourceId);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Audio Source
        </h3>
        {isLive && (
          <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Cannot change while live
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {audioSources.map((source) => {
          const Icon = source.icon;
          const isSelected = audioSource === source.id;
          const isDisabled = disabled || isLive || !source.supported;
          
          return (
            <button
              key={source.id}
              onClick={() => handleSourceChange(source.id)}
              disabled={isDisabled}
              className={`
                relative p-4 border-2 rounded-lg transition-all duration-200 text-left
                ${!source.supported 
                  ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed opacity-60' 
                  : isSelected 
                    ? `${source.color} border-current shadow-md` 
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                }
                ${isDisabled && source.supported
                  ? 'opacity-50 cursor-not-allowed' 
                  : source.supported
                    ? 'cursor-pointer'
                    : ''
                }
              `}
              title={!source.supported ? 'Not supported in this browser or requires HTTPS' : ''}
            >
              <div className="flex items-start space-x-3">
                <div className="relative">
                  <Icon className={`w-6 h-6 mt-0.5 flex-shrink-0 ${
                    !source.supported 
                      ? 'text-gray-400' 
                      : isSelected 
                        ? 'text-current' 
                        : 'text-gray-400'
                  }`} />
                  {!source.supported && (
                    <ExclamationTriangleIcon className="w-3 h-3 text-red-500 absolute -top-1 -right-1" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm mb-1">
                    {source.name}
                    {!source.supported && (
                      <span className="text-xs text-red-500 ml-2">(Not Supported)</span>
                    )}
                  </h4>
                  <p className="text-xs opacity-75 line-clamp-2">
                    {source.description}
                  </p>
                </div>
              </div>
              
              {isSelected && source.supported && (
                <div className="absolute top-2 right-2">
                  <div className="w-3 h-3 bg-current rounded-full"></div>
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {audioSource === 'desktop' && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-900/20 dark:border-amber-800">
          <div className="flex items-start space-x-2">
            <ComputerDesktopIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <p className="font-medium mb-1">Desktop Audio Capture</p>
              <p>Your browser will prompt you to select which audio to capture. Choose "System Audio" or a specific application tab.</p>
            </div>
          </div>
        </div>
      )}
      
      {audioSource === 'both' && (
        <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg dark:bg-purple-900/20 dark:border-purple-800">
          <div className="flex items-start space-x-2">
            <SpeakerWaveIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-purple-800 dark:text-purple-300">
              <p className="font-medium mb-1">Mixed Audio</p>
              <p>Both your microphone and desktop audio will be captured and mixed together. Desktop audio volume is automatically reduced to 80% to balance with your voice.</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Browser Compatibility Warning */}
      {(!browserSupport.desktop || !browserSupport.both) && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-800">
          <div className="flex items-start space-x-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800 dark:text-yellow-300">
              <p className="font-medium mb-1">Desktop Audio Not Available</p>
              <div className="space-y-1">
                {!window.isSecureContext && (
                  <p>• Requires HTTPS connection (or localhost for development)</p>
                )}
                {!navigator.mediaDevices?.getDisplayMedia && (
                  <p>• Browser doesn't support screen sharing API</p>
                )}
                <p>• Try using Chrome, Firefox, or Edge browsers</p>
                <p>• Microphone-only mode is available and works in all browsers</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioSourceSelector; 