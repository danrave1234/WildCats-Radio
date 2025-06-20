import React from 'react';
import { motion } from 'framer-motion';

const CircularLoader = ({ 
  size = 'md', 
  variant = 'primary',
  showText = true,
  text = 'Loading...',
  className = ''
}) => {
  // Size configurations
  const sizeConfig = {
    sm: { diameter: 40, strokeWidth: 3, textSize: 'text-sm' },
    md: { diameter: 60, strokeWidth: 4, textSize: 'text-base' },
    lg: { diameter: 80, strokeWidth: 5, textSize: 'text-lg' },
    xl: { diameter: 120, strokeWidth: 6, textSize: 'text-xl' }
  };

  // Color variants
  const variants = {
    primary: {
      track: 'stroke-gray-200 dark:stroke-gray-700',
      progress: 'stroke-maroon-600 dark:stroke-maroon-400',
      text: 'text-maroon-700 dark:text-maroon-300'
    },
    secondary: {
      track: 'stroke-gray-200 dark:stroke-gray-700', 
      progress: 'stroke-blue-500 dark:stroke-blue-400',
      text: 'text-blue-600 dark:text-blue-400'
    },
    success: {
      track: 'stroke-gray-200 dark:stroke-gray-700',
      progress: 'stroke-green-500 dark:stroke-green-400', 
      text: 'text-green-600 dark:text-green-400'
    }
  };

  const config = sizeConfig[size];
  const colors = variants[variant];
  const radius = (config.diameter - config.strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* Main circular loader */}
      <div className="relative">
        <svg
          width={config.diameter}
          height={config.diameter}
          className="transform -rotate-90"
        >
          {/* Background track */}
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            className={`fill-none ${colors.track}`}
            strokeWidth={config.strokeWidth}
          />
          
          {/* Animated progress circle */}
          <motion.circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            className={`fill-none ${colors.progress}`}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ 
              strokeDashoffset: [circumference, circumference * 0.2, circumference]
            }}
            transition={{
              duration: 2,
              ease: "easeInOut",
              repeat: Infinity
            }}
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(145, 64, 62, 0.2))'
            }}
          />
        </svg>

        {/* Center pulsing dot */}
        <motion.div
          className={`absolute inset-0 flex items-center justify-center`}
          initial={{ scale: 0.8, opacity: 0.6 }}
          animate={{ 
            scale: [0.8, 1.2, 0.8],
            opacity: [0.6, 1, 0.6]
          }}
          transition={{
            duration: 1.5,
            ease: "easeInOut", 
            repeat: Infinity
          }}
        >
          <div 
            className={`w-2 h-2 rounded-full bg-maroon-600 dark:bg-maroon-400`}
            style={{
              boxShadow: '0 0 8px rgba(145, 64, 62, 0.6)'
            }}
          />
        </motion.div>

        {/* Outer rotating ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent"
          style={{
            borderTopColor: 'rgba(145, 64, 62, 0.3)',
            borderRightColor: 'rgba(145, 64, 62, 0.1)',
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: 3,
            ease: "linear",
            repeat: Infinity
          }}
        />
      </div>

      {/* Loading text */}
      {showText && (
        <motion.div 
          className={`mt-4 font-medium ${colors.text} ${config.textSize}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ 
            opacity: [0.7, 1, 0.7],
            y: 0
          }}
          transition={{
            opacity: {
              duration: 2,
              ease: "easeInOut",
              repeat: Infinity
            },
            y: {
              duration: 0.6,
              ease: "easeOut"
            }
          }}
        >
          {text}
        </motion.div>
      )}

      {/* Subtle background glow */}
      <div 
        className="absolute inset-0 rounded-full opacity-20 blur-xl"
        style={{
          background: 'radial-gradient(circle, rgba(145, 64, 62, 0.3) 0%, transparent 70%)',
          transform: 'scale(1.5)',
          zIndex: -1
        }}
      />
    </div>
  );
};

export default CircularLoader; 