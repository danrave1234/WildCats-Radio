import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Broadcast, ChatMessageDTO } from '../../services/apiService';
// import LoginPrompt from '../LoginPrompt';
import AnimatedMessage from './AnimatedMessage';

interface ChatTabProps {
  authToken: string | null;
  isLoading: boolean;
  isRefreshingChat: boolean;
  isWebSocketConnected: boolean;
  memoizedChatMessages: ChatMessageDTO[];
  messageOwnershipMap: Map<number, boolean>;
  chatScrollViewRef: React.RefObject<ScrollView>;
  slowModeEnabled: boolean;
  slowModeSeconds: number;
  slowModeWaitSeconds: number | null;
  isBanned: boolean;
  banMessage: string | null;
  currentBroadcast: Broadcast | null;
  chatInput: string;
  setChatInput: (text: string) => void;
  isSubmitting: boolean;
  handleSendChatMessage: () => void;
}

const ChatTab: React.FC<ChatTabProps> = ({
  authToken,
  isLoading,
  isRefreshingChat,
  isWebSocketConnected,
  memoizedChatMessages,
  messageOwnershipMap,
  chatScrollViewRef,
  slowModeEnabled,
  slowModeSeconds,
  slowModeWaitSeconds,
  isBanned,
  banMessage,
  currentBroadcast,
  chatInput,
  setChatInput,
  isSubmitting,
  handleSendChatMessage,
}) => {
  return (
    <View style={{ flex: 1 }} className="bg-gray-50">
      {/* Header removed per request: no title/status banner above chat */}

      <ScrollView
        ref={chatScrollViewRef}
        className="flex-1 bg-gray-50"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: memoizedChatMessages.length === 0 ? 'center' : 'flex-end',
          paddingTop: 12,
          paddingBottom: 12,
          paddingHorizontal: 0, // full-bleed width like website
        }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {isLoading && memoizedChatMessages.length === 0 && (
          <View className="flex-1 items-center justify-center py-20">
            <View className="bg-white rounded-2xl p-8 shadow-xl items-center">
              <ActivityIndicator size="large" color="#91403E" className="mb-4" />
              <Text className="text-cordovan font-semibold text-lg">Loading chat...</Text>
            </View>
          </View>
        )}

        {!isLoading && memoizedChatMessages.length === 0 && (
          <View className="flex-1 items-center justify-center py-20 px-8">
            <Ionicons name="chatbubbles-outline" size={48} color="#91403E" className="mb-4" />
            <Text className="text-2xl font-bold text-cordovan mb-3 text-center">
              Start the Conversation!
            </Text>
            <Text className="text-gray-600 text-center text-base leading-relaxed mb-6">
              Be the first to chat with the DJ and fellow listeners. Share your thoughts, make requests,
              or just say hello!
            </Text>

            {!isWebSocketConnected && (
              <View className="bg-red-50 p-4 rounded-xl border border-red-200">
                <Text className="text-red-600 text-center text-sm font-medium">
                  ⚠️ Chat is currently offline. Check your connection.
                </Text>
              </View>
            )}
          </View>
        )}

        {memoizedChatMessages.map((msg, index) => {
          const isOwnMessage = messageOwnershipMap.get(msg.id) || false;
          
          // Helper to identify sender for grouping
          const getSenderId = (m: ChatMessageDTO) => {
             if (m.sender?.id) return `id:${m.sender.id}`;
             if (m.sender?.name) return `name:${m.sender.name}`;
             const firstName = m.sender?.firstname || "";
             const lastName = m.sender?.lastname || "";
             const fullName = `${firstName} ${lastName}`.trim();
             if (fullName) return `name:${fullName}`;
             if (m.sender?.email) return `email:${m.sender.email}`;
             return 'unknown';
          };

          const currentSenderId = getSenderId(msg);
          const nextSenderId = index < memoizedChatMessages.length - 1 ? getSenderId(memoizedChatMessages[index + 1]) : null;
          const prevSenderId = index > 0 ? getSenderId(memoizedChatMessages[index - 1]) : null;

          const showAvatar = index === memoizedChatMessages.length - 1 || nextSenderId !== currentSenderId;
          const isLastInGroup = index === memoizedChatMessages.length - 1 || nextSenderId !== currentSenderId;
          const isFirstInGroup = index === 0 || prevSenderId !== currentSenderId;

          return (
            <AnimatedMessage
              key={msg.id}
              message={msg}
              index={index}
              isOwnMessage={isOwnMessage}
              showAvatar={showAvatar}
              isLastInGroup={isLastInGroup}
              isFirstInGroup={isFirstInGroup}
            />
          );
        })}
      </ScrollView>

      {slowModeEnabled && slowModeSeconds > 0 && (
        <View className="bg-amber-50 border-t border-amber-200 px-4 py-2">
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={16} color="#D97706" />
            <Text className="ml-2 text-amber-700 text-sm font-medium">
              Slow mode is active ({slowModeSeconds}s between messages)
            </Text>
          </View>
          {slowModeWaitSeconds !== null && slowModeWaitSeconds > 0 && (
            <Text className="text-amber-600 text-xs mt-1">
              Please wait {slowModeWaitSeconds} second{slowModeWaitSeconds !== 1 ? 's' : ''} before
              sending another message
            </Text>
          )}
        </View>
      )}

      {isBanned && (
        <View className="bg-red-50 border-t border-red-200 px-4 py-2">
          <View className="flex-row items-center">
            <Ionicons name="ban-outline" size={16} color="#DC2626" />
            <Text className="ml-2 text-red-700 text-sm font-medium">
              {banMessage || 'You have been banned from this chat.'}
            </Text>
          </View>
        </View>
      )}

      <View
        className="bg-white border-t border-gray-200 px-4 py-3"
        style={{
          // Remove shadow so the composer doesn't appear to float above the navbar
          shadowColor: 'transparent',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0,
          shadowRadius: 0,
          elevation: 0,
          // Keep composer snug to the bottom of the card so it appears right above the navbar
          marginBottom: 0,
        }}
      >
        <View className="flex-row items-end">
          <View
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 mr-3"
            style={{ minHeight: 40, maxHeight: 100 }}
          >
            <TextInput
              placeholder={!authToken
                ? 'Login to chat'
                : (isBanned ? 'You are banned from chatting' : 'Type your message...')}
              placeholderTextColor="#9CA3AF"
              value={chatInput}
              onChangeText={setChatInput}
              editable={!isSubmitting && !!currentBroadcast && !isBanned && !!authToken}
              className="text-gray-800 text-base py-1"
              multiline
              textAlignVertical="top"
              style={{ fontSize: 16, lineHeight: 20, minHeight: 24 }}
              onContentSizeChange={() => {
                setTimeout(() => {
                  chatScrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }}
              onFocus={() => {
                setTimeout(() => {
                  chatScrollViewRef.current?.scrollToEnd({ animated: true });
                }, 200);
              }}
            />
          </View>

          <TouchableOpacity
            onPress={handleSendChatMessage}
            disabled={!authToken || !currentBroadcast || !chatInput.trim() || isBanned}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              authToken && currentBroadcast && chatInput.trim() ? 'bg-cordovan active:bg-cordovan/90' : 'bg-gray-300'
            }`}
            style={{
              shadowColor: authToken && currentBroadcast && chatInput.trim() ? '#91403E' : '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: authToken && currentBroadcast && chatInput.trim() ? 0.25 : 0.1,
              shadowRadius: 3,
              elevation: authToken && currentBroadcast && chatInput.trim() ? 4 : 2,
            }}
          >
            <Ionicons
              name="send"
              size={18}
              color={authToken && currentBroadcast && chatInput.trim() ? 'white' : '#6B7280'}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default ChatTab;

