import rateLimit from 'express-rate-limit';

const buildRateLimitResponse = (message) => ({
    success: false,
    errCode: 429,
    errMessage: message,
});

const getAuthenticatedUserKey = (req) => {
    return String(req.user?.id || req.user?._id || 'authenticated-user');
};

export const createDeliveryQrLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: buildRateLimitResponse('Bạn tạo QR quá nhiều lần, vui lòng thử lại sau'),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getAuthenticatedUserKey,
});

export const verifyDeliveryQrLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: buildRateLimitResponse('Bạn quét QR quá nhiều lần, vui lòng thử lại sau'),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getAuthenticatedUserKey,
});
