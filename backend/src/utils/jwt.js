import jwt from 'jsonwebtoken';

/**
 * Tạo Temp Token cho quá trình đăng ký (chứa thông tin tạm)
 * Hết hạn sau 10 phút
 */
export const createTempToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_TEMP_SECRET, { expiresIn: '10m' });
};

/**
 * Tạo Access Token (ngắn hạn - 15 phút)
 * Dùng để xác thực các request API
 * Payload chứa: id, roleId
 */
export const createAccessToken = (user) => { 
    return jwt.sign(
        { id: user._id, roleId: user.roleId },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
    );
};

/**
 * Tạo Refresh Token (dài hạn - 7 ngày)
 * Dùng để cấp lại Access Token khi hết hạn
 * Payload chứa: id, roleId
 */
export const createRefreshToken = (user) => {
    return jwt.sign(
        { id: user._id, roleId: user.roleId },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
    );
};

/**
 * Verify Access Token
 * Trả về decoded payload hoặc null nếu không hợp lệ
 */
export const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return null;
    }
};

/**
 * Verify Refresh Token
 * Trả về decoded payload hoặc null nếu không hợp lệ
 */
export const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
        return null;
    }
};