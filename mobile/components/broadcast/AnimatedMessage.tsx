import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Text, View, Easing } from 'react-native';
import { ChatMessageDTO } from '../../services/apiService';

export interface AnimatedMessageProps {
  message: ChatMessageDTO;
  index: number;
  isOwnMessage: boolean;
  showAvatar: boolean;
  isLastInGroup: boolean;
  isFirstInGroup: boolean;
}

const AnimatedMessage: React.FC<AnimatedMessageProps> = React.memo(
  ({ message, isOwnMessage, showAvatar, isLastInGroup, isFirstInGroup }) => {
    // Initialize with 0 opacity but ready to animate
    const slideAnim = useRef(new Animated.Value(20)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
      // Run animation immediately on mount
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.back(1), // Slight bounce effect
        }),
      ]).start();
    }, []);

    useEffect(() => {
      const timer = setInterval(() => {
        setCurrentTime(new Date());
      }, 60000);
      return () => clearInterval(timer);
    }, []);

    const borderRadius = useMemo(() => {
      const base = 18;
      const tight = 4;
      if (isOwnMessage) {
        if (isFirstInGroup && isLastInGroup) {
          return {
            borderTopLeftRadius: base,
            borderTopRightRadius: base,
            borderBottomLeftRadius: base,
            borderBottomRightRadius: base,
          };
        }
        if (isFirstInGroup) {
          return {
            borderTopLeftRadius: base,
            borderTopRightRadius: base,
            borderBottomLeftRadius: base,
            borderBottomRightRadius: tight,
          };
        }
        if (isLastInGroup) {
          return {
            borderTopLeftRadius: base,
            borderTopRightRadius: tight,
            borderBottomLeftRadius: base,
            borderBottomRightRadius: base,
          };
        }
        return {
          borderTopLeftRadius: base,
          borderTopRightRadius: tight,
          borderBottomLeftRadius: base,
          borderBottomRightRadius: tight,
        };
      }

      if (isFirstInGroup && isLastInGroup) {
        return {
          borderTopLeftRadius: base,
          borderTopRightRadius: base,
          borderBottomLeftRadius: base,
          borderBottomRightRadius: base,
        };
      }
      if (isFirstInGroup) {
        return {
          borderTopLeftRadius: base,
          borderTopRightRadius: base,
          borderBottomLeftRadius: tight,
          borderBottomRightRadius: base,
        };
      }
      if (isLastInGroup) {
        return {
          borderTopLeftRadius: tight,
          borderTopRightRadius: base,
          borderBottomLeftRadius: base,
          borderBottomRightRadius: base,
        };
      }
      return {
        borderTopLeftRadius: tight,
        borderTopRightRadius: base,
        borderBottomLeftRadius: tight,
        borderBottomRightRadius: base,
      };
    }, [isOwnMessage, isFirstInGroup, isLastInGroup]);

    const formatTimestamp = () => {
      try {
        if (!message.createdAt || typeof message.createdAt !== 'string') {
          return 'Just now';
        }

        let messageDate = new Date(message.createdAt);
        if (isNaN(messageDate.getTime())) {
          messageDate = message.createdAt.endsWith('Z')
            ? new Date(message.createdAt)
            : new Date(`${message.createdAt}Z`);
        }

        if (!messageDate || isNaN(messageDate.getTime())) {
          return 'Just now';
        }

        const diffInSeconds = Math.floor(
          (currentTime.getTime() - messageDate.getTime()) / 1000
        );
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInHours < 24) return `${diffInHours}h ago`;
        if (diffInDays === 1) return 'Yesterday';
        if (diffInDays < 7) return `${diffInDays}d ago`;

        return messageDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      } catch {
        return 'Just now';
      }
    };

    const getSenderName = () => {
      const sender = message.sender;
      if (!sender) return 'Unknown User';
      
      if (sender.name) return sender.name;
      
      const firstName = sender.firstname || "";
      const lastName = sender.lastname || "";
      const fullName = `${firstName} ${lastName}`.trim();
      
      return fullName || sender.email || 'Unknown User';
    };

    const senderName = getSenderName();

    return (
      <Animated.View
        style={{
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          opacity: opacityAnim,
        }}
        className={`${isFirstInGroup ? 'mt-3' : 'mt-1'} ${
          isOwnMessage ? 'items-end' : 'flex-row items-end'
        }`}
      >
        {!isOwnMessage && (
          <Animated.View
            className="mr-3 mb-1"
            style={{
              opacity: showAvatar ? 1 : 0,
              transform: [{ scale: showAvatar ? 1 : 0.5 }],
            }}
          >
            {showAvatar ? (
              <View
                className="w-8 h-8 rounded-full bg-cordovan items-center justify-center"
                style={{
                  shadowColor: '#91403E',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.2,
                  shadowRadius: 2,
                  elevation: 3,
                }}
              >
                <Text className="text-white text-xs font-bold">
                  {(() => {
                    if (senderName.toLowerCase().includes('dj')) {
                      return 'DJ';
                    }
                    return senderName.charAt(0).toUpperCase();
                  })()}
                </Text>
              </View>
            ) : (
              <View className="w-8 h-8" />
            )}
          </Animated.View>
        )}

        <View
          className={`${isOwnMessage ? 'max-w-[95%]' : 'max-w-[95%]'} w-full`}
          style={{ alignSelf: isOwnMessage ? 'flex-end' : 'flex-start' }}
        >
          {isFirstInGroup && (
            <Animated.View
              className={`flex-row items-center ${isOwnMessage ? 'justify-end pr-3' : 'justify-start pl-3'} mb-1`}
              style={{ opacity: opacityAnim }}
            >
              {!isOwnMessage && (
                <Text className="text-xs font-semibold text-gray-700 mr-2">
                  {senderName}
                </Text>
              )}
              {isOwnMessage && (
                <Text className="text-xs font-semibold text-gray-700 mr-2">You</Text>
              )}
              <Text className="text-[10px] text-gray-500">
                {(() => {
                  try {
                    const d = new Date(message.createdAt);
                    if (isNaN(d.getTime())) return '';
                    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                  } catch { return ''; }
                })()}
              </Text>
            </Animated.View>
          )}

          <Animated.View
            style={[
              {
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: isOwnMessage ? '#91403E' : '#F5F5F5',
                ...borderRadius,
                transform: [{ scale: scaleAnim }],
                alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isOwnMessage ? 0.2 : 0.1,
                shadowRadius: 2,
                elevation: 2,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 16,
                lineHeight: 20,
                color: isOwnMessage ? '#FFFFFF' : '#000000',
                fontWeight: '400',
              }}
            >
              {message.content || ''}
            </Text>
          </Animated.View>

          {isLastInGroup && (
            <Animated.Text
              className={`text-[10px] text-gray-400 mt-1 ${
                isOwnMessage ? 'mr-3 text-right' : 'ml-3'
              }`}
              style={{
                opacity: opacityAnim,
                alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
              }}
            >
              {(() => {
                try {
                  const d = new Date(message.createdAt);
                  if (isNaN(d.getTime())) return 'Just now';
                  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                } catch { return 'Just now'; }
              })()}
            </Animated.Text>
          )}
        </View>
      </Animated.View>
    );
  },
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.isOwnMessage === next.isOwnMessage &&
    prev.showAvatar === next.showAvatar &&
    prev.isLastInGroup === next.isLastInGroup &&
    prev.isFirstInGroup === next.isFirstInGroup
);

export default AnimatedMessage;

