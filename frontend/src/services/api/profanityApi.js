import { api } from './apiBase';

export const profanityApi = {
  // Get all keywords (DB backed)
  async listWords() {
    const res = await api.get('/api/moderation/keywords');
    // Map response to simple strings for backward compatibility if needed, 
    // or return objects if UI supports it. 
    // The current UI expects strings array: setProfanityWords(Array.isArray(data) ? data : [])
    // The new API returns DTO objects { word, tier, ... }
    // So we need to map it or update UI.
    // Let's update UI to handle objects, but for now map to strings to keep it working minimally.
    // Wait, the UI expects strings to display chips.
    // I'll return objects and update UI to display `word (Tier X)`.
    return res.data;
  },
  
  // Add new keyword
  async addWord(word, tier = 1) {
    const res = await api.post('/api/moderation/keywords', { word, tier });
    return res.data;
  },

  // Delete keyword (new)
  async deleteWord(id) {
    await api.delete(`/api/moderation/keywords/${id}`);
  },

  // Update tier (new)
  async updateTier(id, tier) {
    const res = await api.put(`/api/moderation/keywords/${id}`, { tier });
    return res.data;
  }
};

// Legacy export name for convenience
export const profanityService = profanityApi;
