import mongoose from 'mongoose';
import Order from '../models/order.model.js';
import { applyStockForOrderItems, buildOrderDraftFromCart, clearCart, mapOrder, normalizeText } from './checkout.helper.js';

const DEFAULT_PAYMENT_METHOD = 'COD';
const SUPPORTED_PAYMENT_METHODS = ['COD'];

class OrderServiceError extends Error {
    constructor(statusCode, message, code = 'ORDER_ERROR', details = null) {
        super(message);
        this.name = 'OrderServiceError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOrderServiceError = true;
    }
}

const createServiceError = (statusCode, message, code = 'ORDER_ERROR', details = null) => {
    return new OrderServiceError(statusCode, message, code, details);
};

const normalizePaymentMethod = (value) => {
    const paymentMethod = normalizeText(value || DEFAULT_PAYMENT_METHOD).toUpperCase();

    if (!SUPPORTED_PAYMENT_METHODS.includes(paymentMethod)) {
        throw createServiceError(400, 'Hiện tại hệ thống chỉ hỗ trợ thanh toán COD', 'UNSUPPORTED_PAYMENT_METHOD', {
            paymentMethod,
            supportedMethods: SUPPORTED_PAYMENT_METHODS,
        });
    }

    return paymentMethod;
};

const generateOrderCode = () => {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();

    return `COD${datePart}${randomPart}`;
};

const normalizePagination = ({ page = 1, limit = 10 } = {}) => {
    const normalizedPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const normalizedLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 10));

    return {
        page: normalizedPage,
        limit: normalizedLimit,
        skip: (normalizedPage - 1) * normalizedLimit,
    };
};

const getOrderOwnershipFilter = (userId, orderIdOrCode) => {
    const filter = { user: userId };

    if (mongoose.isValidObjectId(orderIdOrCode)) {
        filter._id = orderIdOrCode;
        return filter;
    }

    filter.orderCode = normalizeText(orderIdOrCode).toUpperCase();
    return filter;
};

const MINUTES_TO_CANCEL_NEW_ORDER = 30;
const CANCELLABLE_NEW_STATUSES = ['NEW'];
const REQUEST_CANCEL_STATUSES = ['PREPARING'];
const FINAL_STATUSES = ['CANCELLED', 'DELIVERED'];
const AUTO_CONFIRM_AFTER_MINUTES = 30;

const getMinutesSince = (date) => {
    const createdAt = new Date(date).getTime();

    if (!Number.isFinite(createdAt)) {
        return Number.POSITIVE_INFINITY;
    }

    return (Date.now() - createdAt) / 60000;
};

const getAutoConfirmDate = () => {
    return new Date(Date.now() - AUTO_CONFIRM_AFTER_MINUTES * 60000);
};

const autoConfirmExpiredNewOrders = async (userId = null) => {
    const filter = {
        status: 'NEW',
        createdAt: { $lte: getAutoConfirmDate() },
    };

    if (userId) {
        filter.user = userId;
    }

    await Order.updateMany(filter, {
        $set: { status: 'CONFIRMED' },
        $push: {
            statusHistory: {
                status: 'CONFIRMED',
                note: 'Đơn hàng được tự động xác nhận sau 30 phút',
                changedAt: new Date(),
            },
        },
    });
};

const getCancelDecision = (order) => {
    if (!order) {
        return {
            action: 'BLOCK',
            message: 'Không tìm thấy đơn hàng',
            code: 'ORDER_NOT_FOUND',
            statusCode: 404,
        };
    }

    if (FINAL_STATUSES.includes(order.status)) {
        return {
            action: 'BLOCK',
            message: 'Đơn hàng đã hoàn tất hoặc đã hủy, không thể hủy tiếp',
            code: 'ORDER_ALREADY_FINALIZED',
            statusCode: 400,
        };
    }

    if (CANCELLABLE_NEW_STATUSES.includes(order.status)) {
        const minutesSinceCreated = getMinutesSince(order.createdAt);

        if (minutesSinceCreated > MINUTES_TO_CANCEL_NEW_ORDER) {
            return {
                action: 'BLOCK',
                message: 'Đơn hàng đã quá 30 phút, không thể hủy trực tiếp',
                code: 'CANCEL_WINDOW_EXPIRED',
                statusCode: 400,
            };
        }

        return { action: 'CANCEL' };
    }

    if (REQUEST_CANCEL_STATUSES.includes(order.status)) {
        return { action: 'REQUEST_CANCEL' };
    }

    if (order.status === 'CANCEL_REQUESTED') {
        return {
            action: 'BLOCK',
            message: 'Đơn hàng đã gửi yêu cầu hủy, vui lòng chờ shop xử lý',
            code: 'CANCEL_ALREADY_REQUESTED',
            statusCode: 400,
        };
    }

    return {
        action: 'BLOCK',
        message: 'Đơn hàng ở trạng thái hiện tại không thể hủy',
        code: 'ORDER_CANNOT_BE_CANCELLED',
        statusCode: 400,
    };
};

export const checkoutOrder = async ({ userId, shippingInfo, paymentMethod }) => {
    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
    const session = await mongoose.startSession();

    try {
        let createdOrder = null;

        await session.withTransaction(async () => {
            const orderDraft = await buildOrderDraftFromCart({
                userId,
                shippingInfo,
                session,
                createServiceError,
            });

            await applyStockForOrderItems(orderDraft.orderItems, session, createServiceError);

            const [order] = await Order.create(
                [
                    {
                        orderCode: generateOrderCode(),
                        user: userId,
                        items: orderDraft.orderItems,
                        shippingInfo: orderDraft.shippingInfo,
                        subtotal: orderDraft.subtotal,
                        shippingFee: orderDraft.shippingFee,
                        totalAmount: orderDraft.totalAmount,
                        paymentMethod: normalizedPaymentMethod,
                        paymentStatus: 'UNPAID',
                        status: 'NEW',
                        statusHistory: [{ status: 'NEW', note: `Đơn hàng ${normalizedPaymentMethod} mới được tạo`, changedAt: new Date() }],
                    },
                ],
                { session }
            );

            await clearCart(orderDraft.cart, session);
            createdOrder = order;
        });

        return mapOrder(createdOrder);
    } finally {
        await session.endSession();
    }
};

export const getMyOrders = async ({ userId, page, limit, status }) => {
    if (!mongoose.isValidObjectId(userId)) {
        throw createServiceError(400, 'Người dùng không hợp lệ', 'INVALID_OBJECT_ID');
    }

    const paging = normalizePagination({ page, limit });
    const filter = { user: userId };
    const normalizedStatus = normalizeText(status).toUpperCase();
    await autoConfirmExpiredNewOrders(userId);

    if (normalizedStatus) {
        const validStatuses = Order.schema.path('status').enumValues;
        if (!validStatuses.includes(normalizedStatus)) {
            throw createServiceError(400, 'Trạng thái đơn hàng không hợp lệ', 'INVALID_ORDER_STATUS', {
                status: normalizedStatus,
                validStatuses,
            });
        }

        filter.status = normalizedStatus;
    }

    const [orders, total] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit).lean(),
        Order.countDocuments(filter),
    ]);

    return {
        items: orders.map(mapOrder),
        pagination: {
            page: paging.page,
            limit: paging.limit,
            total,
            totalPages: Math.ceil(total / paging.limit),
        },
    };
};

export const getMyOrderDetail = async ({ userId, orderIdOrCode }) => {
    if (!mongoose.isValidObjectId(userId)) {
        throw createServiceError(400, 'Người dùng không hợp lệ', 'INVALID_OBJECT_ID');
    }

    const orderKey = normalizeText(orderIdOrCode);
    if (!orderKey) {
        throw createServiceError(400, 'Mã đơn hàng không hợp lệ', 'INVALID_ORDER_KEY');
    }

    await autoConfirmExpiredNewOrders(userId);
    const order = await Order.findOne(getOrderOwnershipFilter(userId, orderKey)).lean();

    if (!order) {
        throw createServiceError(404, 'Không tìm thấy đơn hàng', 'ORDER_NOT_FOUND');
    }

    return mapOrder(order);
};

export const cancelMyOrder = async ({ userId, orderIdOrCode, reason }) => {
    if (!mongoose.isValidObjectId(userId)) {
        throw createServiceError(400, 'Người dùng không hợp lệ', 'INVALID_OBJECT_ID');
    }

    const orderKey = normalizeText(orderIdOrCode);
    if (!orderKey) {
        throw createServiceError(400, 'Mã đơn hàng không hợp lệ', 'INVALID_ORDER_KEY');
    }

    const cancelReason = normalizeText(reason);
    if (cancelReason.length > 300) {
        throw createServiceError(400, 'Lý do hủy không được vượt quá 300 ký tự', 'INVALID_CANCEL_REASON');
    }

    await autoConfirmExpiredNewOrders(userId);
    const order = await Order.findOne(getOrderOwnershipFilter(userId, orderKey));
    const decision = getCancelDecision(order);

    if (decision.action === 'BLOCK') {
        throw createServiceError(decision.statusCode, decision.message, decision.code);
    }

    if (decision.action === 'CANCEL') {
        order.status = 'CANCELLED';
        if (order.paymentStatus === 'PAID') {
            order.paymentStatus = 'REFUND_REQUIRED';
        }
        order.statusHistory.push({
            status: 'CANCELLED',
            note: cancelReason || 'Người dùng hủy đơn trong thời gian cho phép',
            changedAt: new Date(),
        });
    }

    if (decision.action === 'REQUEST_CANCEL') {
        order.status = 'CANCEL_REQUESTED';
        order.statusHistory.push({
            status: 'CANCEL_REQUESTED',
            note: cancelReason || 'Người dùng gửi yêu cầu hủy đơn cho shop',
            changedAt: new Date(),
        });
    }

    await order.save();

    return mapOrder(order);
};

export { OrderServiceError };
