import { api } from './apiBase';

export const appealsApi = {
  // Create an appeal
  async createAppeal(reason) {
    const res = await api.post('/api/moderation/appeals', { reason });
    return res.data;
  },

  // Get appeals for the current user
  async getMyAppeals() {
    const res = await api.get('/api/moderation/appeals/my');
    return res.data;
  },

  // Get pending appeals (Admin/Moderator only)
  async getPendingAppeals() {
    const res = await api.get('/api/moderation/appeals/pending');
    return res.data;
  },

  // Resolve an appeal (Admin/Moderator only)
  // decision: 'APPROVED' or 'DENIED'
  async resolveAppeal(id, decision, notes) {
    const res = await api.put(`/api/moderation/appeals/${id}/resolve`, { decision, notes });
    return res.data;
  }
};

export const appealService = appealsApi;

