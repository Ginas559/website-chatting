import { LoyaltyServiceError, getMyLoyaltySummary } from '../services/loyalty.service.js';

const sendSuccessResponse = (res, { message, data, status = 200 }) => {
    return res.status(status).json({
        success: true,
        errCode: 0,
        errMessage: message,
        data,
    });
};

const sendErrorResponse = (res, { status, message, error }) => {
    return res.status(status).json({
        success: false,
        errCode: status === 404 ? 1 : status === 401 ? -2 : status === 403 ? -3 : -1,
        errMessage: message,
        errorCode: error?.code || null,
        error: error?.message || null,
    });
};

const getUserIdFromRequest = (req) => req.user?.id || req.user?._id || null;

export const getMyLoyaltyController = async (req, res) => {
    try {
        const data = await getMyLoyaltySummary(getUserIdFromRequest(req));

        return sendSuccessResponse(res, {
            message: 'Lấy thông tin ví ưu đãi thành công',
            data,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof LoyaltyServiceError ? error.statusCode : 500,
            message: error instanceof LoyaltyServiceError ? error.message : 'Lỗi server khi lấy ví ưu đãi',
            error,
        });
    }
};
