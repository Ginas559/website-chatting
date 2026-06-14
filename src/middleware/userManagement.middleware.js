import { body, param } from 'express-validator';

const staffRoles = ['R3', 'R4'];

export const createUserValidator = [
    body('email').trim().isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Mật khẩu tối thiểu 6 ký tự'),
    body('firstName').trim().notEmpty().withMessage('Họ không được để trống'),
    body('lastName').trim().notEmpty().withMessage('Tên không được để trống'),
    body('roleId').optional().isIn(staffRoles).withMessage('Chỉ được tạo tài khoản Manager hoặc Shipper'),
    body('positionId').optional().trim().isString(),
    body('address').optional().trim().isString(),
    body('phoneNumber').optional().trim().isString(),
    body('image').optional().trim().isString(),
    body('gender').optional().isBoolean().withMessage('gender phải là boolean'),
    body('isActive').optional().isBoolean().withMessage('isActive phải là boolean')
];

export const updateUserValidator = [
    param('id').isMongoId().withMessage('ID người dùng không hợp lệ'),
    body('email').optional().trim().isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
    body('password').optional().isLength({ min: 6 }).withMessage('Mật khẩu tối thiểu 6 ký tự'),
    body('firstName').optional().trim().notEmpty().withMessage('Họ không được để trống'),
    body('lastName').optional().trim().notEmpty().withMessage('Tên không được để trống'),
    body('roleId').optional().isIn(staffRoles).withMessage('Chỉ được cập nhật thành Manager hoặc Shipper'),
    body('positionId').optional().trim().isString(),
    body('address').optional().trim().isString(),
    body('phoneNumber').optional().trim().isString(),
    body('image').optional().trim().isString(),
    body('gender').optional().isBoolean().withMessage('gender phải là boolean'),
    body('isActive').optional().isBoolean().withMessage('isActive phải là boolean')
];

export const deleteUserValidator = [
    param('id').isMongoId().withMessage('ID người dùng không hợp lệ')
];

export const resetUserPasswordValidator = [
    param('id').isMongoId().withMessage('ID người dùng không hợp lệ'),
    body('newPassword').isLength({ min: 6 }).withMessage('Mật khẩu mới tối thiểu 6 ký tự')
];
