// frontend/src/lib/apiClient.ts
import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1",
  withCredentials: true,
});

// Request Interceptor: Attach Access Token
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response Interceptor: Handle 401s and Silent Token Refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 (Unauthorized) and we haven't already retried this request
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Mark as retried to avoid infinite loops

      if (typeof window !== "undefined") {
        const refreshToken = localStorage.getItem("refresh_token");

        if (refreshToken) {
          try {
            // Make a direct request using base axios to avoid hitting this interceptor again
            const refreshRes = await axios.post(
              `${api.defaults.baseURL}/auth/refresh`,
              { refresh_token: refreshToken }
            );

            const { access_token, refresh_token } = refreshRes.data;

            // Save the new tokens
            localStorage.setItem("access_token", access_token);
            localStorage.setItem("refresh_token", refresh_token);

            // Update the failed request's auth header and retry it!
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
            return api(originalRequest);
            
          } catch (refreshError) {
            // The refresh token failed (it expired or is invalid)
            console.error("Refresh token expired, logging out.");
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            window.location.href = "/login";
            return Promise.reject(refreshError);
          }
        } else {
          // No refresh token available, force logout
          localStorage.removeItem("access_token");
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;