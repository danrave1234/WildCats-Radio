import { useState, useEffect } from 'react';
import { broadcastApi } from '../../services/api/broadcastApi';
import { format } from 'date-fns';

export default function HandoverLogViewer({ broadcastId, onDJSelect }) {
  const [handovers, setHandovers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDJId, setSelectedDJId] = useState(null);

  useEffect(() => {
    if (broadcastId) {
      fetchHandoverHistory();
    }
  }, [broadcastId]);

  const fetchHandoverHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await broadcastApi.getHandoverHistory(broadcastId);
      setHandovers(response.data || []);
    } catch (err) {
      console.error('Error fetching handover history:', err);
      setError('Failed to load handover history');
    } finally {
      setLoading(false);
    }
  };

  const handleDJClick = (djId) => {
    if (onDJSelect) {
      onDJSelect(djId);
    }
    setSelectedDJId(djId === selectedDJId ? null : djId);
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        Loading handover history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
      </div>
    );
  }

  if (handovers.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        No handovers recorded for this broadcast.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
        Handover History
      </h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {handovers.map((handover, index) => (
          <div
            key={handover.id || index}
            className={`p-3 border rounded-lg ${
              selectedDJId === handover.newDJ?.id
                ? 'border-maroon-500 bg-maroon-50 dark:bg-maroon-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {handover.previousDJ ? (
                    <>
                      <span
                        className="text-sm font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:text-maroon-600 dark:hover:text-maroon-400"
                        onClick={() => handleDJClick(handover.previousDJ.id)}
                      >
                        {handover.previousDJ.name || handover.previousDJ.email}
                      </span>
                      <span className="text-gray-400">→</span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">Initial DJ:</span>
                  )}
                  <span
                    className="text-sm font-semibold text-maroon-600 dark:text-maroon-400 cursor-pointer hover:underline"
                    onClick={() => handleDJClick(handover.newDJ.id)}
                  >
                    {handover.newDJ?.name || handover.newDJ?.email}
                  </span>
                </div>
                {handover.handoverTime && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {format(new Date(handover.handoverTime), 'MMM d, yyyy • h:mm a')}
                  </p>
                )}
                {handover.reason && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Reason: {handover.reason}
                  </p>
                )}
                {handover.durationSeconds && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Previous DJ session: {Math.floor(handover.durationSeconds / 60)} minutes
                  </p>
                )}
                {handover.initiatedBy && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Initiated by: {handover.initiatedBy.name || handover.initiatedBy.email}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

