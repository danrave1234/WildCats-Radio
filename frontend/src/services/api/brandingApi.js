import { api } from './apiBase';

export const brandingApi = {
  getBanner: () => api.get('/api/branding/banner'),
  uploadBanner: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/api/branding/banner', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  deleteBanner: () => api.delete('/api/branding/banner'),
};

export default brandingApi;
