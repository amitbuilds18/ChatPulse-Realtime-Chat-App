import axios from "axios";

const API_BASE_URL = "http://localhost:5001/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

// Request interceptor: attach JWT bearer token if stored
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("chat_token");
    if (token) {
      if (config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        config.headers = { Authorization: `Bearer ${token}` };
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token if invalid or expired
      localStorage.removeItem("chat_token");
      localStorage.removeItem("chat_user");
    }
    return Promise.reject(error);
  }
);

export default api;
