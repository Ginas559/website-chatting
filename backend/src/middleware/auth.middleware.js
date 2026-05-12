import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';

export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: 5,
    message: { error: "Quá nhiều yêu cầu đăng ký, vui lòng thử lại sau 1 giờ" }
});

export const registerValidator = [
    body('email').isEmail().normalizeEmail().withMessage('Email không hợp lệ'),
    body('password').isLength({ min: 6 }).withMessage('Mật khẩu tối thiểu 6 ký tự'),
    body('firstName').trim().escape().notEmpty().withMessage('Họ và tên đệm không được để trống'),
    body('lastName').trim().escape().notEmpty().withMessage('Tên không được để trống')
];

export const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: "Quá nhiều yêu cầu quên mật khẩu, vui lòng thử lại sau 1 giờ" }
});

export const forgotPasswordValidator = [
    body('email').isEmail().normalizeEmail().withMessage('Email không hợp lệ')
];

export const resetPasswordValidator = [
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP phải gồm 6 chữ số'),
    body('newPassword').isLength({ min: 6 }).withMessage('Mật khẩu mới tối thiểu 6 ký tự'),
    body('tempToken').notEmpty().withMessage('Token xác thực không được để trống')
];
