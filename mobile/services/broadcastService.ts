import axios from 'axios';

const API_BASE_URL = 'https://wildcat-radio-f05d362144e6.herokuapp.com/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Broadcast service methods
export const getLive = () => api.get('/broadcasts/live');
export const getUpcoming = () => api.get('/broadcasts/upcoming');
export const getByDate = (date: string) => api.get(`/broadcasts/date/${date}`);
export const getById = (id: string) => api.get(`/broadcasts/${id}`);
export const getChatMessages = (broadcastId: string) => api.get(`/chat/broadcast/${broadcastId}`);
export const sendChatMessage = (broadcastId: string, data: any) => api.post(`/chat/broadcast/${broadcastId}`, data);
export const requestSong = (broadcastId: string, data: any) => api.post(`/song-requests/broadcast/${broadcastId}`, data);
export const getActivePoll = (broadcastId: string) => api.get(`/polls/broadcast/${broadcastId}/active`);
export const submitPollVote = (pollId: string, data: any) => api.post(`/polls/${pollId}/vote`, data);
