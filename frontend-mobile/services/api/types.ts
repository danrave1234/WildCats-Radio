/**
 * API Response and Request Types
 */

// User Types
export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

// Broadcast Types
export interface Broadcast {
  id: number;
  title: string;
  description: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string;
  actualEnd?: string;
  status: string;
  dj?: User;
}

export interface CreateBroadcastRequest {
  title: string;
  description: string;
  scheduledStart: string;
  scheduledEnd: string;
  djId: number;
}

// Chat Message Types
export interface ChatMessage {
  id: number;
  content: string;
  timestamp: string;
  sender: User;
  broadcastId?: number;
}

export interface SendChatMessageRequest {
  content: string;
  broadcastId?: number;
}

// Song Request Types
export interface SongRequest {
  id: number;
  songTitle: string;
  artist: string;
  requestedBy: User;
  status: string;
  timestamp: string;
  broadcastId?: number;
}

export interface CreateSongRequestRequest {
  songTitle: string;
  artist: string;
  broadcastId?: number;
}

// Poll Types
export interface PollOption {
  id: number;
  text: string;
  voteCount: number;
}

export interface Poll {
  id: number;
  question: string;
  options: PollOption[];
  startTime: string;
  endTime: string;
  isActive: boolean;
  broadcastId?: number;
}

export interface CreatePollRequest {
  question: string;
  options: string[];
  endTime: string;
  broadcastId?: number;
}

export interface VotePollRequest {
  optionId: number;
}

// Notification Types
export interface Notification {
  id: number;
  message: string;
  timestamp: string;
  read: boolean;
  type: string;
  recipientId: number;
}

// Error Response Type
export interface ApiError {
  status: number;
  message: string;
  error?: string;
  timestamp?: string;
  path?: string;
} 