import { api } from './apiBase';

export const profanityApi = {
  async listWords() {
    const res = await api.get('/api/profanity/words');
    return res.data;
  },
  async addWord(word) {
    const res = await api.post('/api/profanity/words', { word });
    return res.data;
  },
};

// Legacy export name for convenience
export const profanityService = profanityApi;
