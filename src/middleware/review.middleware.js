import { body } from 'express-validator';

export const createReviewValidator = [
    body('productSlug')
        .trim()
        .notEmpty().withMessage('Slug sản phẩm không được để trống')
        .isLength({ min: 2, max: 180 }).withMessage('Slug sản phẩm không hợp lệ'),
    body('orderCode')
        .optional({ nullable: true })
        .trim()
        .isLength({ min: 1, max: 64 }).withMessage('Mã đơn hàng không hợp lệ'),
    body('rating')
        .notEmpty().withMessage('Đánh giá không được để trống')
        .isInt({ min: 1, max: 5 }).withMessage('Đánh giá phải từ 1 đến 5 sao'),
    body('title')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 120 }).withMessage('Tiêu đề đánh giá không được vượt quá 120 ký tự'),
    body('content')
        .trim()
        .notEmpty().withMessage('Nội dung đánh giá không được để trống')
        .isLength({ max: 1000 }).withMessage('Nội dung đánh giá không được vượt quá 1000 ký tự'),
];