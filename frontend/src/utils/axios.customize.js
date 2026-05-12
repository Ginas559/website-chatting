import axios from 'axios';

/**
 * Axios Instance - cấu hình chung cho tất cả API calls
 * Không set baseURL → request đi qua Vite proxy (dev)
 * hoặc gọi trực tiếp cùng origin (production)
 */
const instance = axios.create();

// Request interceptor: Gắn Access Token
instance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor: Trả về data trực tiếp
instance.interceptors.response.use(
    (response) => response.data,
    (error) => {
        if (error?.response?.data) return error.response.data;
        return Promise.reject(error);
    }
);

export default instance;
