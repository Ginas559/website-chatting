import { handleVnpayIpn, PaymentServiceError, verifyVnpayReturn } from '../services/payment.service.js';

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
        error: error?.details || error?.message || null,
    });
};

export const vnpayIpnController = async (req, res) => {
    try {
        const result = await handleVnpayIpn(req.query || {});

        return res.status(200).json(result);
    } catch (error) {
        return res.status(200).json({
            RspCode: '99',
            Message: error?.message || 'Unknown error',
        });
    }
};

export const vnpayReturnController = async (req, res) => {
    try {
        const result = verifyVnpayReturn(req.query || {});

        return sendSuccessResponse(res, {
            message: result.isSuccess ? 'Thanh toán VNPay thành công' : 'Thanh toán VNPay không thành công',
            data: result,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof PaymentServiceError ? error.statusCode : 400,
            message: error instanceof PaymentServiceError ? error.message : 'Không thể xác thực kết quả thanh toán VNPay',
            error,
        });
    }
};
