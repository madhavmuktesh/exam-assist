import axios, { AxiosRequestHeaders, InternalAxiosRequestConfig } from "axios";

type RetryableAxiosRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const api = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers = (config.headers ?? {}) as AxiosRequestHeaders;
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableAxiosRequestConfig | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (typeof window !== "undefined") {
        const refreshToken = localStorage.getItem("refresh_token");

        if (refreshToken) {
          try {
            const refreshRes = await axios.post(
              `${api.defaults.baseURL}/auth/refresh`,
              { refresh_token: refreshToken },
            );

            const { access_token, refresh_token } = refreshRes.data;

            localStorage.setItem("access_token", access_token);

            if (refresh_token) {
              localStorage.setItem("refresh_token", refresh_token);
            }

            originalRequest.headers = (originalRequest.headers ?? {}) as AxiosRequestHeaders;
            originalRequest.headers.Authorization = `Bearer ${access_token}`;

            return api(originalRequest);
          } catch (refreshError) {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            window.location.href = "/login";
            return Promise.reject(refreshError);
          }
        }

        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

export default api;