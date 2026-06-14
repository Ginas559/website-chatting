import { body, param } from 'express-validator';

export const startLivestreamValidator = [
    body('title')
        .trim()
        .isLength({ min: 2 })
        .withMessage('Tiêu đề livestream tối thiểu 2 ký tự'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Mô tả livestream tối đa 500 ký tự'),
];

export const endLivestreamValidator = [
    param('id').isMongoId().withMessage('ID livestream không hợp lệ'),
];
