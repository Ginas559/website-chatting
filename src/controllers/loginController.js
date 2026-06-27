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
            if (result.errCode === 1 || result.errCode === 2) {
                const remaining = req.rateLimit ? req.rateLimit.remaining : null;
                let message = 'Tài khoản hoặc mật khẩu không hợp lệ.';
                if (remaining !== null) {
                    message += ` Bạn còn ${remaining} lần thử trước khi bị chặn.`;
                }
                return res.status(401).json({
                    errCode: result.errCode,
                    errMessage: message,
                    remainingAttempts: remaining
                });
            }
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

let getManagerProfile = async (req, res) => {
    try {
        let userId = req.user.id;
        let result = await loginService.getUserProfile(userId);

        if (result.errCode !== 0) {
            return res.status(404).json(result);
        }

        return res.status(200).json({
            errCode: 0,
            errMessage: 'Lấy thông tin profile thành công (Manager)',
            role: 'manager',
            user: result.user
        });
    } catch (error) {
        console.error('Manager Profile Controller Error:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi lấy thông tin profile'
        });
    }
};

let getShipperProfile = async (req, res) => {
    try {
        let userId = req.user.id;
        let result = await loginService.getUserProfile(userId);

        if (result.errCode !== 0) {
            return res.status(404).json(result);
        }

        return res.status(200).json({
            errCode: 0,
            errMessage: 'Lấy thông tin profile thành công (Shipper)',
            role: 'shipper',
            user: result.user
        });
    } catch (error) {
        console.error('Shipper Profile Controller Error:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi lấy thông tin profile'
        });
    }
};

let changePassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            errCode: -1,
            errMessage: 'Dữ liệu không hợp lệ',
            errors: errors.array()
        });
    }

    try {
        const result = await loginService.changePassword({
            userId: req.user.id,
            currentPassword: req.body.currentPassword,
            newPassword: req.body.newPassword
        });

        if (result.errCode !== 0) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Change Password Controller Error:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi đổi mật khẩu'
        });
    }
};

module.exports = {
    handleLogin,
    handleRefreshToken,
    handleLogout,
    getUserProfile,
    getAdminProfile,
    getManagerProfile,
    getShipperProfile,
    changePassword
};
