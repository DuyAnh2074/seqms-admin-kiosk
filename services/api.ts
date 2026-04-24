import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * Base API URL Configuration
 * Có thể đổi thành environment variable: import.meta.env.VITE_API_BASE_URL
 */
const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:10000/api';
const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, '');
const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || API_BASE_URL.replace(/\/api$/, '')).replace(/\/+$/, '');

/**
 * Create Axios Instance với cấu hình mặc định
 */
const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // 30 seconds
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * REQUEST INTERCEPTOR
 * Tự động thêm Authorization Bearer Token vào mọi request
 */
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('authToken');

        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error: AxiosError) => {
        return Promise.reject(error);
    }
);

/**
 * RESPONSE INTERCEPTOR
 * Xử lý global error: Token hết hạn → Auto logout
 */
api.interceptors.response.use(
    (response: AxiosResponse) => {
        // Response thành công, trả về nguyên vẹn
        return response;
    },
    (error: AxiosError<{ success?: boolean; message?: string; error?: any }>) => {
        // Xử lý lỗi từ server
        if (error.response) {
            const { status, data } = error.response;
            const message = data?.message || '';

            // Kiểm tra điều kiện: Token không hợp lệ HOẶC Token hết hạn
            const isAuthError = status === 401 || status === 403;
            const isTokenInvalid =
                message.toLowerCase().includes('token') ||
                message.toLowerCase().includes('invalid') ||
                message.toLowerCase().includes('malformed') ||
                message.toLowerCase().includes('unauthorized');
            const isTokenExpired =
                message.toLowerCase().includes('expired') ||
                message.toLowerCase().includes('expire') ||
                message.toLowerCase().includes('authentication');

            if (isAuthError && (isTokenInvalid || isTokenExpired)) {
                // Log để debug với thông tin chi tiết
                const reason = isTokenExpired ? 'Token hết hạn' : 'Token không hợp lệ';
                console.warn(`🔒 ${reason}:`, message, '- Triggering auth:logout event');

                // CHỈ dispatch event - KHÔNG clear localStorage ở đây
                // App.tsx sẽ nhận event, hiển thị modal, và clear auth khi user confirm
                window.dispatchEvent(new CustomEvent('auth:logout', {
                    detail: { reason, message }
                }));
            }
        }

        // Trả về Promise.reject để component có thể catch lỗi
        return Promise.reject(error);
    }
);

/**
 * Export axios instance
 */
export default api;

/**
 * Export BASE_URL cho các trường hợp đặc biệt cần dùng
 */
export { API_BASE_URL };
export { SOCKET_URL };
