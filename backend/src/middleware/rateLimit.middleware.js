const rateLimit = require('express-rate-limit');

/**
 * Rate Limiting cho Edit Profile API
 * Mục đích: Bảo vệ API khỏi spam/brute force attacks
 * Giới hạn: 10 requests trong 15 phút (900 giây) per IP
 */
const editProfileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // Tối đa 10 requests
  message: {
    success: false,
    message: 'Too many profile update requests, please try again later',
  },
  standardHeaders: true, // Trả về RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  keyGenerator: (req, res) => {
    // Sử dụng user ID thay vì IP nếu user đã đăng nhập
    return req.user?.id || req.ip;
  },
});

/**
 * Rate Limiting nới lỏng cho certain endpoints
 * Giới hạn: 30 requests trong 15 phút
 */
const relaxedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  editProfileLimiter,
  relaxedLimiter,
};
