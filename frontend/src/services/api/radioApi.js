import { api } from './apiBase';

export const radioApi = {
  start: () => api.post('/api/radio/start'),
  stop: () => api.post('/api/radio/stop'),
  status: () => api.get('/api/radio/status'),
};


