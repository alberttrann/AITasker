import axios, { type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { useAuthStore } from '@store/auth.store';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

//  Request interceptor — attach Bearer token 
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

//  Response interceptor — handle 401 with token refresh 
// Uses a flag to prevent multiple simultaneous refresh calls 
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject:  (err: unknown)  => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => (token ? p.resolve(token) : p.reject(error)));
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const original = error.config;

    // 1. Check if the failing request is a login or register request
    // Note: Adjust '/login' and '/register' to match your exact backend endpoint URLs!
    const isAuthRequest = original.url?.includes('/login') || original.url?.includes('/register');

    // 2. Ignore the 401 if it's an auth request. Let the modal handle the error!
    if (
      error.response?.status !== 401 ||
      original._retry ||
      original.url?.includes('/auth/refresh') ||
      isAuthRequest 
    ) {
      return Promise.reject(error);
    }

    const { refreshToken, setTokens, logout } = useAuthStore.getState();

    // Now, this redirect will only happen if a logged-in user's session expires
    if (!refreshToken) {
      logout();
      window.location.href = '/'; // It's better to redirect to home ('/') when using an Auth Modal
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token } = data;
      setTokens(access_token, refresh_token);
      processQueue(null, access_token);

      original.headers.Authorization = `Bearer ${access_token}`;
      return apiClient(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      logout();
      window.location.href = '/'; // Redirect to home here as well
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
export default apiClient;