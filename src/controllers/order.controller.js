import {
    cancelMyOrder,
    checkoutOrder,
    createAdminDeliveryQr,
    getAdminDeliveryQr,
    getAdminOrderDetail,
    getAdminOrders,
    getMyOrderDetail,
    getMyOrders,
    OrderServiceError,
    previewCheckout,
    resolveAdminCancelRequest,
    updateAdminOrderStatus,
    verifyMyDeliveryQr,
} from '../services/order.service.js';
import { createVnpayPaymentForExistingOrder, createVnpayPaymentFromCart, PaymentServiceError } from '../services/payment.service.js';

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
        const couponCode = req.body?.couponCode;
        const usePoints = req.body?.usePoints;

        if (paymentMethod === 'VNPAY') {
            const payment = await createVnpayPaymentFromCart({
                userId,
                shippingInfo: req.body?.shippingInfo || req.body || {},
                ipAddr: getClientIpFromRequest(req),
                bankCode: req.body?.bankCode,
                couponCode,
                usePoints,
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
            couponCode,
            usePoints,
            shippingDistanceKm: req.body?.shippingDistanceKm ?? req.body?.shippingInfo?.shippingDistanceKm,
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
            ipAddr: getClientIpFromRequest(req),
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

export const repayVnpayOrderController = async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        const payment = await createVnpayPaymentForExistingOrder({
            userId,
            orderIdOrCode: req.params?.orderIdOrCode,
            ipAddr: getClientIpFromRequest(req),
            bankCode: req.body?.bankCode,
        });

        return sendSuccessResponse(res, {
            message: 'Tạo lại link thanh toán VNPay thành công',
            data: payment,
        });
    } catch (error) {
        const knownError = error instanceof PaymentServiceError;

        return sendErrorResponse(res, {
            status: knownError ? error.statusCode : 500,
            message: knownError ? error.message : 'Lỗi server khi tạo lại thanh toán VNPay',
            error,
        });
    }
};

export const getAdminOrdersController = async (req, res) => {
    try {
        const result = await getAdminOrders({
            page: req.query?.page,
            limit: req.query?.limit,
            status: req.query?.status,
            keyword: req.query?.keyword,
            riskLevel: req.query?.riskLevel,
            isSuspicious: req.query?.isSuspicious,
        });

        return sendSuccessResponse(res, {
            message: 'Lấy danh sách đơn hàng thành công',
            data: result,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof OrderServiceError ? error.statusCode : 500,
            message: error instanceof OrderServiceError ? error.message : 'Lỗi server khi lấy danh sách đơn hàng',
            error,
        });
    }
};

export const getAdminOrderDetailController = async (req, res) => {
    try {
        const order = await getAdminOrderDetail({
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

export const updateAdminOrderStatusController = async (req, res) => {
    try {
        const order = await updateAdminOrderStatus({
            orderIdOrCode: req.params?.orderIdOrCode,
            status: req.body?.status,
            note: req.body?.note,
        });

        return sendSuccessResponse(res, {
            message: 'Cập nhật trạng thái đơn hàng thành công',
            data: order,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof OrderServiceError ? error.statusCode : 500,
            message: error instanceof OrderServiceError ? error.message : 'Lỗi server khi cập nhật trạng thái đơn hàng',
            error,
        });
    }
};

export const resolveAdminCancelRequestController = async (req, res) => {
    try {
        const order = await resolveAdminCancelRequest({
            orderIdOrCode: req.params?.orderIdOrCode,
            action: req.body?.action,
            note: req.body?.note,
            ipAddr: getClientIpFromRequest(req),
            createdBy: req.user?.email || 'Admin',
        });

        return sendSuccessResponse(res, {
            message: order.status === 'CANCELLED' ? 'Đã chấp nhận yêu cầu hủy đơn' : 'Đã từ chối yêu cầu hủy đơn',
            data: order,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof OrderServiceError ? error.statusCode : 500,
            message: error instanceof OrderServiceError ? error.message : 'Lỗi server khi xử lý yêu cầu hủy đơn',
            error,
        });
    }
};

export const createAdminDeliveryQrController = async (req, res) => {
    try {
        const result = await createAdminDeliveryQr({
            orderIdOrCode: req.params?.orderIdOrCode,
        });

        return sendSuccessResponse(res, {
            message: 'Tạo QR kiểm tra kiện hàng thành công',
            data: result,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof OrderServiceError ? error.statusCode : 500,
            message: error instanceof OrderServiceError ? error.message : 'Lỗi server khi tạo QR kiện hàng',
            error,
        });
    }
};

export const getAdminDeliveryQrController = async (req, res) => {
    try {
        const result = await getAdminDeliveryQr({
            orderIdOrCode: req.params?.orderIdOrCode,
        });

        return sendSuccessResponse(res, {
            message: 'Lấy QR kiểm tra kiện hàng thành công',
            data: result,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof OrderServiceError ? error.statusCode : 500,
            message: error instanceof OrderServiceError ? error.message : 'Lỗi server khi lấy QR kiện hàng',
            error,
        });
    }
};

export const verifyMyDeliveryQrController = async (req, res) => {
    try {
        const result = await verifyMyDeliveryQr({
            userId: getUserIdFromRequest(req),
            qrContent: req.body?.qrContent,
        });

        return sendSuccessResponse(res, {
            message: result.message,
            data: result,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof OrderServiceError ? error.statusCode : 500,
            message: error instanceof OrderServiceError ? error.message : 'Lỗi server khi xác minh QR kiện hàng',
            error,
        });
    }
};

// Tien - Controller xử lý yêu cầu tính toán thử tiền giảm giá trước khi đặt hàng
export const previewCheckoutController = async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        const result = await previewCheckout({
            userId,
            shippingInfo: req.body?.shippingInfo || req.body || {},
            couponCode: req.body?.couponCode,
            usePoints: req.body?.usePoints,
        });

        return sendSuccessResponse(res, {
            message: 'Tính toán giảm giá và tổng thanh toán thành công',
            data: result,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof OrderServiceError ? error.statusCode : 500,
            message: error instanceof OrderServiceError ? error.message : 'Lỗi server khi tính toán giảm giá',
            error,
        });
    }
};
///////
