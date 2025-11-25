import React from 'react';
import { motion } from 'framer-motion';
import { Radio, User, Music } from 'lucide-react';

const ReadOnlyView = ({ message, activeDJ }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-slate-900 rounded-lg p-8 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 max-w-md w-full border border-gray-200 dark:border-slate-700"
      >
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-maroon-100 dark:bg-maroon-900/30 rounded-full">
            <Radio className="h-12 w-12 text-maroon-600 dark:text-maroon-400" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Broadcast in Progress
        </h2>
        
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {message || "Another DJ is currently broadcasting. You have read-only access until the broadcast ends or is handed over."}
        </p>
        
        {activeDJ && (
          <div className="bg-gray-100 dark:bg-slate-700/50 rounded-lg p-4 mb-6 flex items-center justify-center space-x-3">
            <div className="bg-white dark:bg-slate-600 p-2 rounded-full">
              <User className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </div>
            <div className="text-left">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Current Active DJ</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {activeDJ.firstname} {activeDJ.lastname}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">@{activeDJ.username}</p>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-center space-x-2 text-sm text-gold-600 dark:text-gold-500 bg-gold-50 dark:bg-gold-900/20 py-2 px-4 rounded-md">
          <Music className="h-4 w-4" />
          <span>Tune in via the Listener Dashboard</span>
        </div>
      </motion.div>
    </div>
  );
};

export default ReadOnlyView;
