import axios from './axios.customize';

/**
 * API Functions - gọi API backend BT02
 * Sử dụng Axios instance đã customize
 */

// ==========================================
// LOGIN APIs (Vũ Minh Khang - 23110238)
// ==========================================

export const loginApi = (email, password) => {
    return axios.post('/api/login', { email, password });
};

export const refreshTokenApi = (refreshToken) => {
    return axios.post('/api/refresh-token', { refreshToken });
};

export const logoutApi = (refreshToken) => {
    return axios.post('/api/logout', { refreshToken });
};

export const getUserProfileApi = () => {
    return axios.get('/user/profile');
};

export const getAdminProfileApi = () => {
    return axios.get('/admin/profile');
};
