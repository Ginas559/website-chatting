import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { verifyAccessToken } from '../utils/jwt';

/**
 * ==========================================
 * MIDDLEWARE BẢO MẬT CHO LOGIN API
 * Áp dụng 4 lớp bảo mật API:
 * 1. Rate Limiting (Lớp 1)
 * 2. Input Validation (Lớp 2)
 * 3. Authentication - JWT (Lớp 3)
 * 4. Authorization - Phân quyền (Lớp 4)
 * ==========================================
 */

// ============================================
// LỚP 1: RATE LIMITING
// Giới hạn số lần request để chống brute-force
// ============================================

/**
 * Rate Limiter cho Login
 * Giới hạn 10 request/15 phút cho mỗi IP
 * Chống tấn công brute-force password
 */
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 10, // Tối đa 10 request mỗi 15 phút
    message: { 
        errCode: -1,
        errMessage: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.' 
    },
    standardHeaders: true, // Gửi rate limit info trong headers `RateLimit-*`
    legacyHeaders: false   // Tắt headers `X-RateLimit-*`
});

/**
 * Rate Limiter cho Refresh Token
 * Giới hạn 30 request/15 phút cho mỗi IP
 */
export const refreshTokenLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { 
        errCode: -1,
        errMessage: 'Quá nhiều yêu cầu refresh token. Vui lòng thử lại sau.' 
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Tạo middleware phân quyền theo danh sách roleId cho phép.
 * Dùng lại cho Admin/Manager/Shipper/User mà không cần viết riêng từng hàm mới.
 */
export const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                errCode: -1,
                errMessage: 'Chưa xác thực'
            });
        }

        if (allowedRoles.includes(req.user.roleId)) {
            return next();
        }

        return res.status(403).json({
            errCode: -1,
            errMessage: 'Bạn không có quyền truy cập trang này'
        });
    };
};

// ============================================
// LỚP 2: INPUT VALIDATION
// Kiểm tra và sanitize dữ liệu đầu vào
// ============================================

/**
 * Validator cho Login
 * Kiểm tra email hợp lệ, password không rỗng
 */
export const loginValidator = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email không được để trống')
        .isEmail().withMessage('Email không đúng định dạng')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Mật khẩu không được để trống')
        .isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự')
];

// ============================================
// LỚP 3: AUTHENTICATION (Xác thực JWT)
// Kiểm tra Access Token trong header
// ============================================

/**
 * Middleware xác thực JWT
 * Kiểm tra Bearer Token trong Authorization header
 * Nếu hợp lệ, gắn thông tin user vào req.user
 */
export const authenticateToken = (req, res, next) => {
    // Lấy token từ Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({
            errCode: -1,
            errMessage: 'Không tìm thấy token xác thực. Vui lòng đăng nhập.'
        });
    }

    // Verify access token
    const decoded = verifyAccessToken(token);
    if (!decoded) {
        return res.status(401).json({
            errCode: -1,
            errMessage: 'Token không hợp lệ hoặc đã hết hạn. Vui lòng refresh token hoặc đăng nhập lại.'
        });
    }

    // Gắn thông tin user đã decode vào request
    req.user = decoded;
    next();
};

// ============================================
// LỚP 4: AUTHORIZATION (Phân quyền)
// Kiểm tra quyền truy cập dựa trên roleId
// ============================================

/**
 * Middleware phân quyền User
 * Chỉ cho phép user có roleId = 'R2' (User)
 * Route: /user/profile
 */
export const authorizeUser = (req, res, next) => {
    return authorizeRoles('R2')(req, res, next);
};

/**
 * Middleware phân quyền Admin
 * Chỉ cho phép user có roleId = 'R1' (Admin)
 * Route: /admin/profile
 */
export const authorizeAdmin = (req, res, next) => {
    return authorizeRoles('R1')(req, res, next);
};

/**
 * Middleware phân quyền Manager
 * Chỉ cho phép user có roleId = 'R3' (Manager)
 */
export const authorizeManager = (req, res, next) => {
    return authorizeRoles('R3')(req, res, next);
};

export const authorizeShipper = (req, res, next) => {
    return authorizeRoles('R4')(req, res, next);
};
