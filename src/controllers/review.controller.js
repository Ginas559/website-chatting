import { validationResult } from 'express-validator';
import { verifyAccessToken } from '../utils/jwt.js';
import { ReviewServiceError, createProductReview, getProductReviewOverview } from '../services/review.service.js';

const sendSuccessResponse = (res, { message, data, pagination, status = 200 }) => {
    return res.status(status).json({
        success: true,
        errCode: 0,
        errMessage: message,
        data,
        ...(pagination ? { pagination } : {}),
    });
};

const sendErrorResponse = (res, { status, message, error }) => {
    return res.status(status).json({
        success: false,
        errCode: status === 404 ? 1 : status === 401 ? -2 : status === 403 ? -3 : -1,
        errMessage: message,
        error: error?.details || error?.message || null,
    });
};

const getOptionalUserId = (req) => {
    const authHeader = req.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
        return null;
    }

    const decoded = verifyAccessToken(token);

    return decoded?.id || decoded?._id || null;
};

export const getProductReviewsController = async (req, res) => {
    try {
        const data = await getProductReviewOverview({
            slug: req.params?.slug,
            page: req.query?.page,
            limit: req.query?.limit,
            rating: req.query?.rating,
            userId: getOptionalUserId(req),
        });

        return sendSuccessResponse(res, {
            message: 'Lấy đánh giá sản phẩm thành công',
            data,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof ReviewServiceError ? error.statusCode : 500,
            message: error instanceof ReviewServiceError ? error.message : 'Lỗi server khi lấy đánh giá sản phẩm',
            error,
        });
    }
};

export const createProductReviewController = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errCode: -1,
            errMessage: 'Dữ liệu không hợp lệ',
            errors: errors.array(),
        });
    }

    try {
        const userId = req.user?.id || req.user?._id || null;
        const result = await createProductReview({
            userId,
            productSlug: req.body?.productSlug,
            orderCode: req.body?.orderCode,
            rating: req.body?.rating,
            title: req.body?.title,
            content: req.body?.content,
        });

        return sendSuccessResponse(res, {
            message: 'Đã lưu đánh giá và cộng thưởng thành công',
            data: result,
            status: 201,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof ReviewServiceError ? error.statusCode : 500,
            message: error instanceof ReviewServiceError ? error.message : 'Lỗi server khi tạo đánh giá sản phẩm',
            error,
        });
    }
};