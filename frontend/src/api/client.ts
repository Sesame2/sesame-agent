import axios from 'axios';

const TOKEN_KEY = 'sesame_token';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000,
});

// Token 管理
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  delete apiClient.defaults.headers.common['Authorization'];
}

// 请求拦截器：确保每请求带 token
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：401 自动跳转登录
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ---- API 接口 ----

export async function login(username: string, password: string) {
  const { data } = await apiClient.post('/api/auth/login', { username, password });
  return data as { token: string; user_id: string; username: string };
}

export async function register(username: string, password: string) {
  const { data } = await apiClient.post('/api/auth/register', { username, password });
  return data as { token: string; user_id: string; username: string };
}
