import axios from 'axios';

// Detect Backend URL from Vite Environment (VITE_API_URL)
const rawUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
export const BACKEND_URL = rawUrl ? rawUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '') : '';
export const API_BASE_URL = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';

/**
 * Resolves a full URL for static assets (like farmer photos and user avatars)
 * Works both locally (defaults to localhost:5000 or proxy) and in cloud deployments (e.g. Render).
 */
export const getAssetUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return BACKEND_URL ? `${BACKEND_URL}${cleanPath}` : `http://localhost:5000${cleanPath}`;
};

const api = axios.create({
  baseURL: API_BASE_URL,
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
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;
