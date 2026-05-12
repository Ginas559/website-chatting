import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { loginApi, logoutApi, refreshTokenApi } from '../../utils/api';

/**
 * Auth Slice - Quản lý state xác thực
 * Sử dụng createAsyncThunk cho các async actions (gọi API)
 * Components sử dụng Redux Hooks: useSelector, useDispatch
 */

// Async Thunk: Đăng nhập
export const loginUser = createAsyncThunk(
    'auth/loginUser',
    async ({ email, password }, { rejectWithValue }) => {
        try {
            const res = await loginApi(email, password);
            if (res && res.errCode === 0) {
                localStorage.setItem('accessToken', res.accessToken);
                localStorage.setItem('refreshToken', res.refreshToken);
                return res;
            } else {
                return rejectWithValue(res);
            }
        } catch (error) {
            return rejectWithValue(
                error?.errMessage || 'Không thể kết nối đến server'
            );
        }
    }
);

// Async Thunk: Refresh Token
export const refreshToken = createAsyncThunk(
    'auth/refreshToken',
    async (_, { rejectWithValue }) => {
        try {
            const token = localStorage.getItem('refreshToken');
            const res = await refreshTokenApi(token);
            if (res && res.errCode === 0) {
                localStorage.setItem('accessToken', res.accessToken);
                localStorage.setItem('refreshToken', res.refreshToken);
                return res;
            }
            return rejectWithValue(res);
        } catch (error) {
            return rejectWithValue(error);
        }
    }
);

// Async Thunk: Đăng xuất
export const logoutUser = createAsyncThunk(
    'auth/logoutUser',
    async () => {
        const token = localStorage.getItem('refreshToken');
        await logoutApi(token).catch(() => {});
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
    }
);

const authSlice = createSlice({
    name: 'auth',
    initialState: {
        isAuthenticated: !!localStorage.getItem('accessToken'),
        user: null,
        loading: false,
        error: null,
    },
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Login
            .addCase(loginUser.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.loading = false;
                state.isAuthenticated = true;
                state.user = action.payload.user;
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.errMessage || action.payload || 'Đăng nhập thất bại';
            })
            // Logout
            .addCase(logoutUser.fulfilled, (state) => {
                state.isAuthenticated = false;
                state.user = null;
                state.error = null;
            });
    },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
