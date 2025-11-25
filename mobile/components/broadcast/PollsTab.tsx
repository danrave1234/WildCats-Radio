import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Broadcast, PollDTO } from '../../services/apiService';
import { pollService } from '../../services/pollService';
import LoginPrompt from '../LoginPrompt';

interface PollsTabProps {
  authToken: string | null;
  activePolls: PollDTO[];
  isLoading: boolean;
  isRefreshingPolls: boolean;
  refreshPollsData: () => void;
  isSubmitting: boolean;
  currentBroadcast: Broadcast | null;
  handleVoteOnPoll: (pollId: number, optionId: number) => void;
}

const PollsTab: React.FC<PollsTabProps> = ({
  authToken,
  activePolls,
  isLoading,
  isRefreshingPolls,
  refreshPollsData,
  isSubmitting,
  currentBroadcast,
  handleVoteOnPoll,
}) => {
  const [currentPoll, setCurrentPoll] = useState<PollDTO | null>(null);
  const [userVoted, setUserVoted] = useState(false);
  const [userVotedFor, setUserVotedFor] = useState<number | null>(null);

  const broadcastId = currentBroadcast?.id;

  // Compute total votes from available fields
  const totalVotes = useMemo(() => {
    if (!currentPoll) return 0;
    return currentPoll.options.reduce((sum, opt: any) => sum + (typeof opt.voteCount === 'number' ? opt.voteCount : (opt.votes || 0)), 0);
  }, [currentPoll]);

  const pickEndedWithVotes = useCallback(async () => {
    if (!authToken || !broadcastId) return null;
    const all = await pollService.getPollsForBroadcast(broadcastId, authToken);
    if ('error' in all) return null;
    const ended = (all.data || []).filter((p) => !p.isActive);
    // fetch results and choose the most recent with votes
    let chosen: PollDTO | null = null;
    for (const poll of ended) {
      const res = await pollService.getPollResults(poll.id, authToken);
      if ('data' in res && res.data) {
        const results = res.data;
        const withCounts: PollDTO = {
          ...poll,
          options: (results.options || []).map((o: any) => ({ id: o.id, text: (o.text || (o.optionText ?? '')), voteCount: (o.voteCount ?? o.votes ?? 0) })),
        } as any;
        const tv = (results as any).totalVotes ?? withCounts.options.reduce((s, o: any) => s + (o.voteCount || 0), 0);
        if (tv > 0) {
          chosen = { ...withCounts } as PollDTO;
          break;
        }
      }
    }
    return chosen;
  }, [authToken, broadcastId]);

  // Load initial current poll following website rules
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!broadcastId) return;
      
      console.log('📊 PollsTab: Checking activePolls:', {
        count: activePolls?.length || 0,
        polls: activePolls?.map(p => ({ id: p.id, question: p.question, isActive: p.isActive }))
      });
      
      // Prefer first active poll if available (handle both true and undefined as active)
      // Also check if we got polls from getActivePolls - those should all be active
      const firstActive = (activePolls || []).find((p) => {
        // Consider poll active if:
        // 1. isActive is explicitly true
        // 2. isActive is undefined but isEnded is not true (defensive check)
        // 3. We got polls from getActivePolls endpoint (they should all be active)
        return p.isActive === true || (p.isActive === undefined && p.isEnded !== true);
      });
      
      // Fallback: if no poll found but we have polls, use the first one (might be from getActivePolls)
      const pollToDisplay = firstActive || (activePolls && activePolls.length > 0 ? activePolls[0] : null);
      
      console.log('📊 PollsTab: Found poll to display:', pollToDisplay ? { 
        id: pollToDisplay.id, 
        question: pollToDisplay.question, 
        isActive: pollToDisplay.isActive,
        isEnded: pollToDisplay.isEnded 
      } : null);
      
      if (pollToDisplay) {
        let pollToUse: PollDTO = pollToDisplay;
        // Enrich with results and user vote
        if (authToken) {
          try {
            const [results, userVote] = await Promise.all([
              pollService.getPollResults(pollToDisplay.id, authToken),
              pollService.getUserVote(pollToDisplay.id, authToken).catch(() => ({ error: 'no' } as any)),
            ]);
            
            // If poll results return an error (like "poll deleted"), remove it from the list
            if (mounted && 'error' in results && results.error) {
              console.log('📊 PollsTab: Poll fetch failed, likely deleted:', results.error);
              // Don't set the poll if it's been deleted
              if (results.error.includes('deleted') || results.error.includes('not found')) {
                // Remove from activePolls
                refreshPollsData();
                return;
              }
            }
            
            if (mounted && 'data' in results && results.data) {
              const r: any = results.data;
              pollToUse = {
                ...pollToUse,
                options: (r.options || []).map((o: any) => ({ id: o.id, text: (o.text || (o.optionText ?? '')), voteCount: (o.voteCount ?? o.votes ?? 0) })),
              } as any;
            }
            if (mounted && userVote && 'data' in userVote && userVote.data) {
              setUserVoted(true);
              setUserVotedFor((userVote.data as any).optionId ?? null);
            } else {
              setUserVoted(false);
              setUserVotedFor(null);
            }
          } catch (error) {
            console.warn('📊 PollsTab: Error enriching poll data:', error);
            // If poll fetch fails, it might be deleted - refresh the list
            if (error && typeof error === 'object' && 'error' in error && 
                (String(error).includes('deleted') || String(error).includes('not found'))) {
              refreshPollsData();
            }
          }
        }
        if (mounted) {
          console.log('📊 PollsTab: Setting current poll:', pollToUse.id, pollToUse.question);
          setCurrentPoll(pollToUse);
        }
        return;
      }
      // No active poll – try most recent ended with votes
      console.log('📊 PollsTab: No active poll found, checking ended polls...');
      const endedChosen = await pickEndedWithVotes();
      if (mounted) {
        console.log('📊 PollsTab: Ended poll chosen:', endedChosen ? endedChosen.id : null);
        setCurrentPoll(endedChosen);
      }
      if (mounted) {
        setUserVoted(false);
        setUserVotedFor(null);
      }
    };
    init();
    return () => { mounted = false; };
  }, [broadcastId, authToken, activePolls, pickEndedWithVotes]);

  // When activePolls update with the same current poll id, refresh counts
  useEffect(() => {
    const refreshActiveCounts = async () => {
      if (!authToken || !currentPoll || !currentPoll.isActive) return;
      const res = await pollService.getPollResults(currentPoll.id, authToken);
      if ('data' in res && res.data) {
        const r: any = res.data;
        setCurrentPoll((prev) => prev ? ({
          ...prev,
          options: (r.options || []).map((o: any) => ({ id: o.id, text: (o.text || (o.optionText ?? '')), voteCount: (o.voteCount ?? o.votes ?? 0) })),
        } as any) : prev);
      } else if ('error' in res && res.error) {
        // If poll fetch fails (likely deleted), clear the current poll and refresh the list
        if (res.error.includes('deleted') || res.error.includes('not found')) {
          console.log('📊 PollsTab: Current poll appears to be deleted, clearing and refreshing');
          setCurrentPoll(null);
          refreshPollsData();
        }
      }
    };
    refreshActiveCounts();
  }, [authToken, currentPoll?.id, activePolls, refreshPollsData]);

  const handleVote = async (optionId: number) => {
    if (!authToken || !currentBroadcast || !currentPoll || isSubmitting) return;
    try {
      await handleVoteOnPoll(currentPoll.id, optionId);
      setUserVoted(true);
      setUserVotedFor(optionId);
      // Refresh results after vote
      if (authToken) {
        const res = await pollService.getPollResults(currentPoll.id, authToken);
        if ('data' in res && res.data) {
          const r: any = res.data;
          setCurrentPoll((prev) => prev ? ({
            ...prev,
            options: (r.options || []).map((o: any) => ({ id: o.id, text: (o.text || (o.optionText ?? '')), voteCount: (o.voteCount ?? o.votes ?? 0) })),
          } as any) : prev);
        }
      }
      // Also refresh parent cache
      refreshPollsData();
    } catch (e) {
      // Parent already alerts on error; no-op here
    }
  };
  if (!authToken) {
    return (
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <LoginPrompt
          title="Login to Vote on Polls"
          message="Sign in to participate in polls and share your opinion with the community."
          icon="stats-chart-outline"
        />

        {activePolls.length > 0 && (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 16,
              marginHorizontal: 20,
              marginTop: 16,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 }}>
              Active Polls
            </Text>
            {activePolls
              .filter(p => p.isActive)
              .map(poll => (
                <View
                  key={poll.id}
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#E5E7EB',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 8 }}>
                    {poll.question}
                  </Text>
                  {poll.options.map(opt => (
                    <View
                      key={opt.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 6,
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: '#D1D5DB',
                          marginRight: 8,
                        }}
                      />
                      <Text style={{ fontSize: 13, color: '#6B7280' }}>{opt.text}</Text>
                    </View>
                  ))}
                </View>
              ))}
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }} className="bg-gray-50">
      {/* Header removed per request: no title banner above Polls */}

      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshingPolls}
            onRefresh={refreshPollsData}
            colors={['#91403E']}
            tintColor="#91403E"
            title="Pull to refresh polls"
            titleColor="#91403E"
          />
        }
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-5 pt-4">
          {isLoading && !currentPoll && <ActivityIndicator color="#91403E" className="my-5" />}

          {!isLoading && !currentPoll && (
            <View className="items-center justify-center py-10 flex-1">
              <Ionicons name="stats-chart-outline" size={40} color="#A0A0A0" />
              <Text className="text-gray-500 mt-2">No polls to show right now.</Text>
              {__DEV__ && activePolls.length > 0 && (
                <Text className="text-gray-400 mt-2 text-xs">
                  Debug: {activePolls.length} poll(s) fetched but none active
                </Text>
              )}
            </View>
          )}

          {currentPoll && (
            <View className="bg-white p-4 rounded-lg shadow mb-3">
              <Text className="text-lg font-bold text-gray-800 mb-2">{currentPoll.question}</Text>
              {currentPoll.options && currentPoll.options.length > 0 ? currentPoll.options.map((opt: any) => {
                const votes = typeof opt.voteCount === 'number' ? opt.voteCount : (opt.votes || 0);
                const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                const selected = userVoted && userVotedFor === opt.id;
                // Allow voting if poll is active (or undefined, which we treat as active from getActivePolls)
                const isPollActive = currentPoll.isActive === true || (currentPoll.isActive === undefined && currentPoll.isEnded !== true);
                const disabled = isSubmitting || !currentBroadcast || !isPollActive || userVoted;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    className={`p-3 rounded-md my-1 border ${selected ? 'bg-amber-50 border-amber-300' : 'bg-gray-100 border-gray-200'} ${disabled ? 'opacity-80' : 'active:bg-gray-200'}`}
                    onPress={() => !disabled && handleVote(opt.id)}
                    disabled={disabled}
                  >
                    <View className="flex-row justify-between items-center">
                      <Text className={`text-sm ${!currentPoll.isActive ? 'text-gray-400' : 'text-gray-700'}`}>
                        {opt.text}
                      </Text>
                      {(userVoted || !currentPoll.isActive) && (
                        <Text className="text-xs text-cordovan font-semibold">{pct}% ({votes})</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }) : (
                <Text className="text-gray-500 text-sm">No options available for this poll.</Text>
              )}

              {!currentPoll.isActive && currentPoll.isEnded && (
                <Text className="text-xs text-gray-500 font-semibold mt-2 text-right">Poll Ended • Total votes: {totalVotes}</Text>
              )}
              {currentPoll.isActive && userVoted && (
                <Text className="text-xs text-gray-500 font-semibold mt-2 text-right">Thanks for voting! Total votes: {totalVotes}</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default PollsTab;

