import { validationResult } from 'express-validator';
import loginService from '../services/loginService';

/**
 * Controller Layer - Xử lý request/response cho Login
 * Kiến trúc 3 tầng: Controller -> Service -> Model
 */

// POST /api/login - Đăng nhập
let handleLogin = async (req, res) => {
    // Kiểm tra validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            errCode: -1,
            errMessage: 'Dữ liệu không hợp lệ',
            errors: errors.array()
        });
    }

    try {
        let { email, password } = req.body;
        let result = await loginService.handleUserLogin(email, password);

        if (result.errCode !== 0) {
            return res.status(401).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Login Controller Error:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server trong quá trình đăng nhập'
        });
    }
};

// POST /api/refresh-token - Cấp lại Access Token mới
let handleRefreshToken = async (req, res) => {
    try {
        let { refreshToken } = req.body;
        let result = await loginService.handleRefreshToken(refreshToken);

        if (result.errCode !== 0) {
            return res.status(401).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Refresh Token Controller Error:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi refresh token'
        });
    }
};

// POST /api/logout - Đăng xuất
let handleLogout = async (req, res) => {
    try {
        let { refreshToken } = req.body;
        let result = await loginService.handleLogout(refreshToken);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Logout Controller Error:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi đăng xuất'
        });
    }
};

// GET /user/profile - Lấy thông tin profile (quyền User)
let getUserProfile = async (req, res) => {
    try {
        let userId = req.user.id; // Lấy từ JWT middleware
        let result = await loginService.getUserProfile(userId);

        if (result.errCode !== 0) {
            return res.status(404).json(result);
        }

        return res.status(200).json({
            errCode: 0,
            errMessage: 'Lấy thông tin profile thành công (User)',
            role: 'user',
            user: result.user
        });
    } catch (error) {
        console.error('User Profile Controller Error:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi lấy thông tin profile'
        });
    }
};

// GET /admin/profile - Lấy thông tin profile (quyền Admin)
let getAdminProfile = async (req, res) => {
    try {
        let userId = req.user.id; // Lấy từ JWT middleware
        let result = await loginService.getUserProfile(userId);

        if (result.errCode !== 0) {
            return res.status(404).json(result);
        }

        return res.status(200).json({
            errCode: 0,
            errMessage: 'Lấy thông tin profile thành công (Admin)',
            role: 'admin',
            user: result.user
        });
    } catch (error) {
        console.error('Admin Profile Controller Error:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi lấy thông tin profile'
        });
    }
};

module.exports = {
    handleLogin,
    handleRefreshToken,
    handleLogout,
    getUserProfile,
    getAdminProfile
};
