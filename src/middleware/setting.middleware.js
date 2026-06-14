import { body } from 'express-validator';

export const updateSettingsValidator = [
    body('shopName').trim().notEmpty().withMessage('Tên cửa hàng không được để trống'),
    body('supportEmail').trim().isEmail().withMessage('Email hỗ trợ không hợp lệ').normalizeEmail(),
    body('supportPhone').trim().notEmpty().withMessage('Số điện thoại hỗ trợ không được để trống'),
    body('shopAddress').optional().trim().isString(),
    body('defaultShippingFee').isFloat({ min: 0 }).withMessage('Phí vận chuyển mặc định phải >= 0'),
    body('cancelOrderLimitMinutes').isInt({ min: 0 }).withMessage('Số phút hủy đơn phải >= 0'),
    body('lowStockThreshold').isInt({ min: 0 }).withMessage('Ngưỡng tồn kho thấp phải >= 0'),
    body('maintenanceMode').isBoolean().withMessage('maintenanceMode phải là boolean'),
    body('maintenanceMessage').optional().trim().isString(),
];
