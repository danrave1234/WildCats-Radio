import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
  Broadcast,
  ChatMessageDTO,
  SongRequestDTO,
  PollDTO,
  getLiveBroadcasts,
  getBroadcastDetails,
  getChatMessages,
  sendChatMessage,
  getSongRequestsForBroadcast,
  createSongRequest,
  getActivePollsForBroadcast,
  voteOnPoll,
} from '../../services/apiService';
import '../../global.css';
import { format, parseISO } from 'date-fns';

interface UserAuthData {
  name?: string;
  fullName?: string;
}

interface TabDefinition {
  key: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// Placeholder for current song - replace with actual data structure from API
interface NowPlayingInfo {
  songTitle: string;
  artist: string;
}

const BroadcastScreen: React.FC = () => {
  const authContext = useAuth();
  const authToken = authContext.authToken;
  const user = (authContext as any).user as UserAuthData | undefined;

  const params = useLocalSearchParams();
  const routeBroadcastId = params.broadcastId ? parseInt(params.broadcastId as string, 10) : null;

  const [activeTab, setActiveTab] = useState('chat');
  const [isLoading, setIsLoading] = useState(true);
  const [isPollingData, setIsPollingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentBroadcast, setCurrentBroadcast] = useState<Broadcast | null>(null);
  // Mock Now Playing Data - replace with API call
  const [nowPlayingInfo, setNowPlayingInfo] = useState<NowPlayingInfo | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageDTO[]>([]);
  const [songRequests, setSongRequests] = useState<SongRequestDTO[]>([]);
  const [activePolls, setActivePolls] = useState<PollDTO[]>([]);

  const [chatInput, setChatInput] = useState('');
  const [songTitleInput, setSongTitleInput] = useState('');
  const [artistInput, setArtistInput] = useState('');
  const [dedicationInput, setDedicationInput] = useState('');

  const chatScrollViewRef = useRef<ScrollView>(null);

  const listenerName = useMemo(() => user?.name || user?.fullName || 'Listener', [user]);

  const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; width: number } | undefined>>({});
  const underlinePosition = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;
  const [isInitialLayoutDone, setIsInitialLayoutDone] = useState(false);

  const tabDefinitions: TabDefinition[] = useMemo(() => [
    { name: 'Chat', icon: 'chatbubbles-outline', key: 'chat' },
    { name: 'Requests', icon: 'musical-notes-outline', key: 'requests' },
    { name: 'Polls', icon: 'stats-chart-outline', key: 'polls' },
  ], []);

  useEffect(() => {
    const currentTabLayout = tabLayouts[activeTab];
    if (currentTabLayout && currentTabLayout.width > 0) {
      if (!isInitialLayoutDone && activeTab === tabDefinitions[0].key) {
        underlinePosition.setValue(currentTabLayout.x);
        underlineWidth.setValue(currentTabLayout.width);
        setIsInitialLayoutDone(true);
      } else if (isInitialLayoutDone) {
        Animated.parallel([
          Animated.timing(underlinePosition, {
            toValue: currentTabLayout.x,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(underlineWidth, {
            toValue: currentTabLayout.width,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
          }),
        ]).start();
      }
    }
  }, [activeTab, tabLayouts, isInitialLayoutDone, tabDefinitions, underlinePosition, underlineWidth]);

  const loadInitialDataForBroadcastScreen = useCallback(async () => {
    if (!authToken) {
      setError("Authentication required.");
      setIsLoading(false);
      setCurrentBroadcast(null);
      setNowPlayingInfo(null); // Clear now playing info
      return;
    }
    setIsLoading(true);
    setError(null);
    setChatMessages([]);
    setActivePolls([]);
    setSongRequests([]);
    setNowPlayingInfo(null); // Clear now playing on new load

    try {
      let broadcastToUse: Broadcast | null = null;
      if (routeBroadcastId) {
        const detailsResult = await getBroadcastDetails(routeBroadcastId, authToken);
        if ('error' in detailsResult) throw new Error(detailsResult.error);
        broadcastToUse = detailsResult;
      } else {
        const liveBroadcastsResult = await getLiveBroadcasts(authToken);
        if ('error' in liveBroadcastsResult) throw new Error(liveBroadcastsResult.error);
        if (liveBroadcastsResult.length > 0) {
          broadcastToUse = liveBroadcastsResult[0];
        } else {
          setCurrentBroadcast(null);
          setNowPlayingInfo(null);
          setIsLoading(false);
          return;
        }
      }
      setCurrentBroadcast(broadcastToUse);

      // MOCK: Set Now Playing Info - Replace with actual API call for current song
      if (broadcastToUse && broadcastToUse.status === 'LIVE') {
        setNowPlayingInfo({ songTitle: 'Wildcat\'s Choice', artist: 'Wildcat Radio' });
        // Example: const songInfo = await getCurrentSongForBroadcast(broadcastToUse.id, authToken);
        // if (!('error' in songInfo)) setNowPlayingInfo(songInfo);
      }

      if (broadcastToUse) {
        const [messagesResult, pollsResult, songRequestsResult] = await Promise.all([
          getChatMessages(broadcastToUse.id, authToken),
          getActivePollsForBroadcast(broadcastToUse.id, authToken),
          getSongRequestsForBroadcast(broadcastToUse.id, authToken),
        ]);

        if (!('error' in messagesResult)) setChatMessages(messagesResult);
        else console.error('Failed to fetch initial chat:', messagesResult.error);

        if (!('error' in pollsResult)) setActivePolls(pollsResult);
        else console.error('Failed to fetch initial polls:', pollsResult.error);

        if (!('error' in songRequestsResult)) setSongRequests(songRequestsResult);
        else console.error('Failed to fetch initial song requests:', songRequestsResult.error);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load broadcast data.");
      setCurrentBroadcast(null);
      setNowPlayingInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, [authToken, routeBroadcastId]);

  useEffect(() => {
    loadInitialDataForBroadcastScreen();
  }, [loadInitialDataForBroadcastScreen]);

  useEffect(() => {
    if (!currentBroadcast?.id || !authToken) {
      return;
    }

    const pollData = async () => {
      if (!currentBroadcast?.id || !authToken) return;
      setIsPollingData(true);
      try {
        const messagesResult = await getChatMessages(currentBroadcast.id, authToken);
        if (!('error' in messagesResult)) {
          setChatMessages(messagesResult);
        } else {
          console.warn('Polling chat error:', messagesResult.error);
        }

        const pollsResult = await getActivePollsForBroadcast(currentBroadcast.id, authToken);
        if (!('error' in pollsResult)) {
          setActivePolls(pollsResult);
        } else {
          console.warn('Polling polls error:', pollsResult.error);
        }
      } catch (err) {
        console.warn("Exception during polling data:", err);
      }
      setIsPollingData(false);
    };

    const intervalId = setInterval(pollData, 15000);
    return () => clearInterval(intervalId);
  }, [currentBroadcast?.id, authToken]);

  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => chatScrollViewRef.current?.scrollToEnd({ animated: true }), 300);
    }
  }, [chatMessages]);

  const handleSendChatMessage = async () => {
    if (!authToken || !currentBroadcast || !chatInput.trim()) return;
    setIsSubmitting(true);
    const tempMessageId = Date.now();
    const optimisticMessage: ChatMessageDTO = {
        id: tempMessageId,
        content: chatInput,
        timestamp: new Date().toISOString(),
        sender: { name: listenerName },
        broadcastId: currentBroadcast.id
    };
    setChatMessages(prev => [...prev, optimisticMessage]);
    const messageToSend = chatInput;
    setChatInput('');

    const result = await sendChatMessage(currentBroadcast.id, { content: messageToSend }, authToken);
    if ('error' in result) {
      Alert.alert("Error", result.error || "Failed to send message.");
      setChatMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
    } else {
      setChatMessages(prev => prev.map(msg => msg.id === tempMessageId ? result : msg));
    }
    setIsSubmitting(false);
  };

  const handleCreateSongRequest = async () => {
    if (!authToken || !currentBroadcast || !songTitleInput.trim() || !artistInput.trim()) {
        Alert.alert("Missing Info", "Please enter both song title and artist.");
        return;
    }
    setIsSubmitting(true);
    const payload = {
      songTitle: songTitleInput,
      artist: artistInput,
      dedication: dedicationInput.trim() || undefined,
    };
    const result = await createSongRequest(currentBroadcast.id, payload, authToken);
    if ('error' in result) {
      Alert.alert("Error", result.error || "Failed to request song.");
    } else {
      Alert.alert("Success", "Song requested successfully!");
      setSongTitleInput('');
      setArtistInput('');
      setDedicationInput('');
    }
    setIsSubmitting(false);
  };

  const handleVoteOnPoll = async (pollId: number, optionId: number) => {
    if (!authToken || !currentBroadcast) return;
    setIsSubmitting(true);
    const result = await voteOnPoll(pollId, { optionId }, authToken);
    if ('error' in result) {
      Alert.alert("Error", result.error || "Failed to submit vote.");
    } else {
      Alert.alert("Success", "Vote submitted!");
      setIsPollingData(true);
      getActivePollsForBroadcast(currentBroadcast.id, authToken)
        .then(pollsResult => {
            if (!('error' in pollsResult)) setActivePolls(pollsResult);
        })
        .catch(err => console.error("Error refreshing polls after vote:", err))
        .finally(() => setIsPollingData(false));
    }
    setIsSubmitting(false);
  };

  const renderChatTab = () => (
    <View style={styles.tabContentContainer} className="flex-1 bg-gray-50">
      <View className="px-5 pt-6 pb-3 border-b border-gray-200 bg-gray-50">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3.5 shadow-sm">
            <Ionicons name="chatbubbles-outline" size={22} color="#2563EB" /> 
          </View>
          <View>
            <Text className="text-xl font-bold text-gray-800">Live Chat</Text>
            <Text className="text-sm text-gray-500">Join the conversation with the DJ</Text>
          </View>
        </View>
      </View>
      <ScrollView
        ref={chatScrollViewRef}
        className="flex-1 px-5 pt-4 bg-white"
        contentContainerStyle={{ paddingBottom: 10 }}
      >
        {(isLoading && chatMessages.length === 0) && <ActivityIndicator color="#91403E" className="my-5"/>}
        {!isLoading && chatMessages.length === 0 && (
          <View className="items-center justify-center py-10 flex-1">
            <Ionicons name="chatbubbles-outline" size={40} color="#A0A0A0" />
            <Text className="text-gray-500 mt-2">No messages yet. Be the first!</Text>
          </View>
        )}
        {chatMessages.map(msg => (
          <View key={msg.id} className={`p-3 rounded-lg mb-2 max-w-[80%] ${msg.sender.name === listenerName ? 'bg-mikado_yellow/80 self-end' : 'bg-white self-start shadow'}`}>
            <Text className={`text-xs font-semibold mb-0.5 ${msg.sender.name === listenerName ? 'text-black/70 text-right' : 'text-cordovan'}`}>{msg.sender.name || 'User'}</Text>
            <Text className={`text-sm ${msg.sender.name === listenerName ? 'text-black' : 'text-gray-800'}`}>{msg.content}</Text>
            <Text className={`text-[10px] mt-1 ${msg.sender.name === listenerName ? 'text-black/60 text-right' : 'text-gray-400 text-left'}`}>{format(parseISO(msg.timestamp), 'p')}</Text>
          </View>
        ))}
      </ScrollView>
      <View className="p-3 border-t border-gray-200 bg-white">
        <View className="flex-row items-center">
          <TextInput
            placeholder="Type your message..."
            value={chatInput}
            onChangeText={setChatInput}
            editable={!isSubmitting && !!currentBroadcast}
            className="flex-1 bg-gray-100 border border-gray-300 rounded-full py-2.5 px-4 mr-2 text-sm"
          />
          <TouchableOpacity
            className={`p-3 rounded-full shadow ${currentBroadcast && chatInput.trim() ? 'bg-cordovan active:bg-cordovan/80' : 'bg-gray-300'}`}
            onPress={handleSendChatMessage}
            disabled={isSubmitting || !currentBroadcast || !chatInput.trim()}
          >
            <Ionicons name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderRequestsTab = () => (
    <ScrollView style={styles.tabContentContainer} className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 30}}>
      <View className="px-5 pt-6 pb-5">
        <View className="flex-row items-center mb-3">
          <View className="w-10 h-10 rounded-full bg-rose-100 items-center justify-center mr-3.5 shadow-sm">
            <MaterialCommunityIcons name="music-note-plus" size={22} color="#DC2626" /> 
          </View>
          <View>
            <Text className="text-xl font-bold text-gray-800">Request a Song</Text>
            <Text className="text-sm text-gray-500">Let us know what you'd like to hear next</Text>
          </View>
        </View>

        <View className="mt-5">
          <Text className="text-sm font-medium text-gray-700 mb-1.5 ml-1">Song Title</Text>
          <TextInput
            placeholder="Enter song title"
            value={songTitleInput}
            onChangeText={setSongTitleInput}
            editable={!isSubmitting && !!currentBroadcast}
            className="bg-white border border-gray-300 rounded-lg p-3.5 text-base shadow-sm text-gray-800 placeholder-gray-400 focus:border-mikado_yellow focus:ring-1 focus:ring-mikado_yellow"
          />
        </View>

        <View className="mt-5">
          <Text className="text-sm font-medium text-gray-700 mb-1.5 ml-1">Artist</Text>
          <TextInput
            placeholder="Enter artist name"
            value={artistInput}
            onChangeText={setArtistInput}
            editable={!isSubmitting && !!currentBroadcast}
            className="bg-white border border-gray-300 rounded-lg p-3.5 text-base shadow-sm text-gray-800 placeholder-gray-400 focus:border-mikado_yellow focus:ring-1 focus:ring-mikado_yellow"
          />
        </View>

        <View className="mt-5">
          <Text className="text-sm font-medium text-gray-700 mb-1.5 ml-1">Dedication (Optional)</Text>
          <TextInput
            placeholder="Add a message or dedication"
            value={dedicationInput}
            onChangeText={setDedicationInput}
            editable={!isSubmitting && !!currentBroadcast}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="bg-white border border-gray-300 rounded-lg p-3.5 text-base shadow-sm h-28 text-gray-800 placeholder-gray-400 focus:border-mikado_yellow focus:ring-1 focus:ring-mikado_yellow"
            style={{ height: 112 }}
          />
        </View>

        <TouchableOpacity
          className={`py-3.5 px-5 rounded-lg shadow-md items-center mt-8 ${currentBroadcast && songTitleInput.trim() && artistInput.trim() && !isSubmitting ? 'bg-mikado_yellow active:bg-mikado_yellow/90' : 'bg-gray-300'}`}
          onPress={handleCreateSongRequest}
          disabled={isSubmitting || !currentBroadcast || !songTitleInput.trim() || !artistInput.trim()}
        >
          {isSubmitting ? <ActivityIndicator color="#27272a" size="small"/> : <Text className="text-zinc-900 font-semibold text-base">Submit Request</Text>}
        </TouchableOpacity>

        <Text className="text-xs text-gray-500 text-center mt-8 px-4">
          Song requests are subject to availability and DJ's playlist.
        </Text>
      </View>
    </ScrollView>
  );

 const renderPollsTab = () => (
    <ScrollView style={styles.tabContentContainer} className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 30}}>
      <View className="px-5 pt-6 pb-3">
        <View className="flex-row items-center mb-3">
          <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center mr-3.5 shadow-sm">
            <Ionicons name="stats-chart-outline" size={22} color="#16A34A" /> 
          </View>
          <View>
            <Text className="text-xl font-bold text-gray-800">Active Polls</Text>
            <Text className="text-sm text-gray-500">Voice your opinion on current topics</Text>
          </View>
        </View>
      </View>

      <View className="px-5">
        {(isLoading && activePolls.length === 0) && <ActivityIndicator color="#91403E" className="my-5"/>}
        {!isLoading && activePolls.length === 0 && (
          <View className="items-center justify-center py-10 flex-1">
            <Ionicons name="stats-chart-outline" size={40} color="#A0A0A0" />
            <Text className="text-gray-500 mt-2">No active polls right now.</Text>
          </View>
        )}
        {activePolls.length > 0 && (
          <View className="flex-1">
            {activePolls.map(poll => (
              <View key={poll.id} className="bg-white p-4 rounded-lg shadow mb-3">
                <Text className="text-base font-semibold text-gray-800 mb-2">{poll.question}</Text>
                {poll.options.map(opt => (
                  <TouchableOpacity
                    key={opt.id} 
                    className={`bg-gray-100 p-3 rounded-md my-1 active:bg-gray-200 hover:bg-gray-200 border border-gray-200 ${isSubmitting ? 'opacity-70' : ''}`}
                    onPress={() => !isSubmitting && currentBroadcast && handleVoteOnPoll(poll.id, opt.id)}
                    disabled={isSubmitting || !currentBroadcast || !poll.isActive}
                  >
                    <View className="flex-row justify-between items-center">
                      <Text className={`text-sm ${!poll.isActive ? 'text-gray-400' : 'text-gray-700'}`}>{opt.text}</Text>
                      {(poll.isEnded) && <Text className="text-xs text-cordovan font-medium">{opt.voteCount} votes</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
                {!poll.isActive && poll.isEnded && (
                    <Text className="text-xs text-gray-500 font-semibold mt-2 text-right">Poll Ended</Text>
                )}
                {!poll.isActive && !poll.isEnded && (
                    <Text className="text-xs text-gray-400 font-semibold mt-2 text-right">Poll Not Yet Active</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderTabContent = () => {
    if (!currentBroadcast && !isLoading) {
      return (
        <View className="flex-1 justify-center items-center p-5 bg-anti-flash_white">
            <Ionicons name="radio-outline" size={50} color="#A0A0A0" className="mb-3"/>
            <Text className="text-xl font-semibold text-gray-700 mb-1">Currently Off Air</Text>
            <Text className="text-gray-500 text-center">There is no live broadcast at the moment. Please check the schedule or try again later.</Text>
        </View>
      );
    }
    switch (activeTab) {
      case 'chat':
        return renderChatTab();
      case 'requests':
        return renderRequestsTab();
      case 'polls':
        return renderPollsTab();
      default:
        return null;
    }
  };

  if (isLoading && !currentBroadcast && !nowPlayingInfo) { // Adjusted loading condition slightly for initial card appearance
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-anti-flash_white">
        <ActivityIndicator size="large" color="#91403E" />
        <Text className="mt-4 text-gray-600 text-lg">Loading Live Broadcast...</Text>
      </SafeAreaView>
    );
  }

   if (error && !isLoading) { 
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-anti-flash_white p-6 text-center">
        <Ionicons name="cloud-offline-outline" size={64} color="#7F1D1D" />
        <Text className="text-2xl font-semibold text-gray-800 mt-6 mb-2">Broadcast Error</Text>
        <Text className="text-gray-600 mb-8 text-base leading-relaxed">{error || "An unexpected error occurred while loading broadcast data."}</Text>
        <TouchableOpacity
          className="bg-cordovan py-3 px-8 rounded-lg shadow-md active:opacity-80"
          onPress={loadInitialDataForBroadcastScreen} 
        >
          <Text className="text-white font-semibold text-base">Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const screenTitle = currentBroadcast ? `${currentBroadcast.title}` : 'Live Broadcast';
  const screenSubtitle = currentBroadcast ? `DJ: ${currentBroadcast.dj?.name || 'Wildcat Radio'}` : 'Standby...';

  const renderNowPlayingCard = () => {
    if (!currentBroadcast || currentBroadcast.status !== 'LIVE' || !nowPlayingInfo) {
      return null; // Don't render if not live or no song info
    }
    return (
      <View className="bg-cordovan/90 p-4 mx-4 my-3 rounded-lg shadow-lg">
        <View className="absolute top-3 right-3 bg-red-600 px-2.5 py-1 rounded-full flex-row items-center z-10">
            <View className="w-1.5 h-1.5 bg-white rounded-full mr-1.5" />
            <Text className="text-white text-xs font-bold">LIVE</Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-24 h-24 bg-black/20 rounded-md items-center justify-center mr-4 shadow">
            <Ionicons name="musical-notes-outline" size={48} color="rgba(255,255,255,0.4)" />
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-white mb-0.5" numberOfLines={2}>{currentBroadcast.title}</Text>
            <Text className="text-sm text-gray-200 mb-2.5">Hosted by {currentBroadcast.dj?.name || 'Wildcat Radio'}</Text>
            
            <Text className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-0.5">Now Playing</Text>
            <Text className="text-lg font-semibold text-white" numberOfLines={1}>{nowPlayingInfo.songTitle}</Text>
            <Text className="text-sm text-gray-200">{nowPlayingInfo.artist}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} className="flex-1 bg-anti-flash_white">
      <Stack.Screen 
        options={{
            headerTitle: () => (
                <View style={{ marginLeft: Platform.OS === 'android' ? -10 : 0}}>
                    <Text className="text-lg font-bold text-gray-800" numberOfLines={1}>{screenTitle}</Text>
                    <Text className="text-xs text-gray-500" numberOfLines={1}>{screenSubtitle}</Text>
                </View>
            ),
        }}
       />
      
      {renderNowPlayingCard()} {/* Render the card here */}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }} // Ensure KAV takes remaining space
        keyboardVerticalOffset={Platform.OS === 'ios' ? (Dimensions.get('window').height > 800 ? 90 : 60) : 0} 
      >
        <View style={styles.tabBar} className="flex-row bg-white border-b border-gray-200 relative">
          {tabDefinitions.map(tab => (
            <Pressable 
              key={tab.key}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                setTabLayouts((prev) => ({ ...prev, [tab.key]: { x, width } }));
              }}
              style={({ pressed }) => [
                { opacity: pressed && Platform.OS === 'ios' ? 0.7 : 1 }, 
              ]}
              className="flex-1 items-center py-3 justify-center flex-row" 
              onPress={() => setActiveTab(tab.key)}
              disabled={!currentBroadcast || isLoading} 
              android_ripple={{ color: 'rgba(0,0,0,0.05)' }} 
            >
              <Ionicons
                name={tab.icon as any}
                size={20}
                color={!currentBroadcast || isLoading ? '#CBD5E0' : (activeTab === tab.key ? '#91403E' : (Platform.OS === 'ios' ? '#6b7280' : '#4B5563'))}
              />
              <Text
                className={`ml-1.5 text-sm ${!currentBroadcast || isLoading ? 'text-gray-400' : (activeTab === tab.key ? 'font-semibold text-cordovan' : 'text-gray-600')}`}
              >
                {tab.name}
              </Text>
            </Pressable>
          ))}
          <Animated.View
            style={{
              position: 'absolute',
              bottom: 0,
              height: 3, 
              backgroundColor: '#B5830F', 
              transform: [{ translateX: underlinePosition }],
              width: underlineWidth,
            }}
          />
        </View>

        <View className="flex-1">
          {renderTabContent()}
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', 
  },
  tabBar: {
  },
  tabContentContainer: {
    flex: 1,
  },
});

export default BroadcastScreen; 