import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';

/**
 * Redux Store
 * Quản lý toàn bộ state của ứng dụng
 */
const store = configureStore({
    reducer: {
        auth: authReducer,
    },
});

export default store;
