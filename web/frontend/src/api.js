import axios from 'axios';

const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://${hostname}:5000/api`;
  }
  return 'https://cp-three-lemon.vercel.app/api';
};

export const resolveApiAssetUrl = (value) => {
  if (!value) return '';
  try {
    return new URL(value).toString();
  } catch {
    const apiOrigin = new URL(getBaseURL(), window.location.origin).origin;
    return new URL(value, `${apiOrigin}/`).toString();
  }
};

const api = axios.create({
  baseURL: getBaseURL(),
});

// Add a request interceptor to include the Bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
