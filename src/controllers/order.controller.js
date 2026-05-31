import { cancelMyOrder, checkoutOrder, getMyOrderDetail, getMyOrders, OrderServiceError } from '../services/order.service.js';
import { createVnpayPaymentFromCart, PaymentServiceError } from '../services/payment.service.js';

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

const getUserIdFromRequest = (req) => {
    return req.user?.id || req.user?._id || null;
};

const getClientIpFromRequest = (req) => {
    const forwardedFor = req.headers['x-forwarded-for'];
    const rawIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0] || req.ip || req.socket?.remoteAddress || '';
    const ip = String(rawIp).trim().replace('::ffff:', '');

    return ip === '::1' ? '127.0.0.1' : ip;
};

const normalizePaymentMethod = (value) => String(value || 'COD').trim().toUpperCase();

export const checkoutOrderController = async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        const paymentMethod = normalizePaymentMethod(req.body?.paymentMethod);

        if (paymentMethod === 'VNPAY') {
            const payment = await createVnpayPaymentFromCart({
                userId,
                shippingInfo: req.body?.shippingInfo || req.body || {},
                ipAddr: getClientIpFromRequest(req),
                bankCode: req.body?.bankCode,
            });

            return sendSuccessResponse(res, {
                message: 'Tạo thanh toán VNPay thành công',
                data: payment,
                status: 201,
            });
        }

        const order = await checkoutOrder({
            userId,
            shippingInfo: req.body?.shippingInfo || req.body || {},
            paymentMethod,
        });

        return sendSuccessResponse(res, {
            message: 'Đặt hàng thành công',
            data: order,
            status: 201,
        });
    } catch (error) {
        const knownError = error instanceof OrderServiceError || error instanceof PaymentServiceError;

        return sendErrorResponse(res, {
            status: knownError ? error.statusCode : 500,
            message: knownError ? error.message : 'Lỗi server khi thanh toán đơn hàng',
            error,
        });
    }
};

export const getMyOrdersController = async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        const result = await getMyOrders({
            userId,
            page: req.query?.page,
            limit: req.query?.limit,
            status: req.query?.status,
        });

        return sendSuccessResponse(res, {
            message: 'Lấy lịch sử đơn hàng thành công',
            data: result,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof OrderServiceError ? error.statusCode : 500,
            message: error instanceof OrderServiceError ? error.message : 'Lỗi server khi lấy lịch sử đơn hàng',
            error,
        });
    }
};

export const getMyOrderDetailController = async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        const order = await getMyOrderDetail({
            userId,
            orderIdOrCode: req.params?.orderIdOrCode,
        });

        return sendSuccessResponse(res, {
            message: 'Lấy chi tiết đơn hàng thành công',
            data: order,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof OrderServiceError ? error.statusCode : 500,
            message: error instanceof OrderServiceError ? error.message : 'Lỗi server khi lấy chi tiết đơn hàng',
            error,
        });
    }
};

export const cancelMyOrderController = async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        const order = await cancelMyOrder({
            userId,
            orderIdOrCode: req.params?.orderIdOrCode,
            reason: req.body?.reason,
        });

        return sendSuccessResponse(res, {
            message: order.status === 'CANCEL_REQUESTED' ? 'Đã gửi yêu cầu hủy đơn cho shop' : 'Hủy đơn hàng thành công',
            data: order,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof OrderServiceError ? error.statusCode : 500,
            message: error instanceof OrderServiceError ? error.message : 'Lỗi server khi hủy đơn hàng',
            error,
        });
    }
};
