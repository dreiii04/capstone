import axios from "axios";

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

const API = axios.create({
  baseURL: getBaseURL(),
    headers: {
    "ngrok-skip-browser-warning": "true", 
  },
});

API.interceptors.request.use((config) => {
 const token = localStorage.getItem("token");
  
if (token) {
  config.headers.set("Authorization", `Bearer ${token}`);
}
  return config;
});

export default API;
