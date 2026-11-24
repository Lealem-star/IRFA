import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach token from localStorage if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('irfa_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for session expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login' && window.location.pathname !== '/') {
      localStorage.removeItem('irfa_token');
      localStorage.removeItem('irfa_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
