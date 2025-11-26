import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Broadcast, SongRequestDTO } from '../../services/apiService';
import LoginPrompt from '../LoginPrompt';

interface RequestsTabProps {
  authToken: string | null;
  songRequests: SongRequestDTO[];
  isRefreshingRequests: boolean;
  refreshRequestsData: () => void;
  currentBroadcast: Broadcast | null;
  songTitleInput: string;
  setSongTitleInput: (value: string) => void;
  isSubmitting: boolean;
  handleCreateSongRequest: () => void;
}

const RequestsTab: React.FC<RequestsTabProps> = ({
  authToken,
  songRequests,
  isRefreshingRequests,
  refreshRequestsData,
  currentBroadcast,
  songTitleInput,
  setSongTitleInput,
  isSubmitting,
  handleCreateSongRequest,
}) => {
  if (!authToken) {
    return (
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <LoginPrompt
          title="Login to Request Songs"
          message="Sign in to request your favorite songs and see what others are requesting."
          icon="musical-notes-outline"
        />

        {songRequests.length > 0 && (
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
              Popular Requests
            </Text>
            {songRequests.slice(0, 5).map(request => (
              <View
                key={request.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: '#E5E7EB',
                }}
              >
                <Ionicons name="musical-note" size={20} color="#91403E" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}>{request.songTitle}</Text>
                  {request.artist && (
                    <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{request.artist}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }} className="bg-gray-50">
      {/* Header removed per request: no title banner above Requests */}

      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshingRequests}
            onRefresh={refreshRequestsData}
            colors={['#91403E']}
            tintColor="#91403E"
            title="Pull to refresh requests"
            titleColor="#91403E"
          />
        }
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-5 pt-4">
          <View className="mt-2">
            <Text className="text-sm font-medium text-gray-700 mb-1.5 ml-1">Song Request</Text>
            <TextInput
              placeholder="Type a song to request (artist optional)"
              placeholderTextColor="#6B7280"
              value={songTitleInput}
              onChangeText={setSongTitleInput}
              editable={!isSubmitting && !!currentBroadcast}
              className="bg-white border border-gray-300 rounded-lg p-3.5 text-base shadow-sm text-gray-800 focus:border-mikado_yellow focus:ring-1 focus:ring-mikado_yellow"
              style={{ fontSize: 16 }}
            />
          </View>

          <TouchableOpacity
            className={`py-3.5 px-5 rounded-lg shadow-md items-center mt-8 ${
              currentBroadcast && songTitleInput.trim() && !isSubmitting
                ? 'bg-mikado_yellow active:bg-mikado_yellow/90'
                : 'bg-gray-300'
            }`}
            onPress={handleCreateSongRequest}
            disabled={isSubmitting || !currentBroadcast || !songTitleInput.trim()}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#27272a" size="small" />
            ) : (
              <Text className="text-zinc-900 font-semibold text-base">Submit Request</Text>
            )}
          </TouchableOpacity>

          <Text className="text-xs text-gray-500 text-center mt-8 px-4">
            Song requests are subject to availability and DJ's playlist.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default RequestsTab;

