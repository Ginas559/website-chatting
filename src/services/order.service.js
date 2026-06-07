import mongoose from 'mongoose';
import Order from '../models/order.model.js';
import { applyStockForOrderItems, buildOrderDraftFromCart, clearCart, mapOrder, normalizeText } from './checkout.helper.js';
import { createNotification } from '../utils/notification';

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

const getOrderFilter = (orderIdOrCode) => {
    if (mongoose.isValidObjectId(orderIdOrCode)) {
        return { _id: orderIdOrCode };
    }

    return { orderCode: normalizeText(orderIdOrCode).toUpperCase() };
};

const MINUTES_TO_CANCEL_NEW_ORDER = 30;
const CANCELLABLE_NEW_STATUSES = ['NEW'];
const REQUEST_CANCEL_STATUSES = ['PREPARING'];
const FINAL_STATUSES = ['CANCELLED', 'DELIVERED'];
const AUTO_CONFIRM_AFTER_MINUTES = 30;
const ADMIN_NEXT_STATUSES = {
    NEW: 'CONFIRMED',
    CONFIRMED: 'PREPARING',
    PREPARING: 'SHIPPING',
    SHIPPING: 'DELIVERED',
};
const ADMIN_STATUS_NOTES = {
    CONFIRMED: 'Shop đã xác nhận đơn hàng của bạn',
    PREPARING: 'Shop đang chuẩn bị hàng cho đơn hàng của bạn',
    SHIPPING: 'Đơn hàng đã được bàn giao cho đơn vị vận chuyển',
    DELIVERED: 'Đơn hàng đã được giao thành công',
};
const USER_ACTIVITY_STATUSES = ['CANCELLED', 'CANCEL_REQUESTED'];
const USER_HISTORY_STATUS_PRIORITY = {
    CANCEL_REQUESTED: 0,
    NEW: 1,
    CANCELLED: 2,
    CONFIRMED: 3,
    PREPARING: 4,
    PENDING_PAYMENT: 5,
    SHIPPING: 6,
    DELIVERED: 7,
};

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
        if (hasRejectedCancelRequest(order)) {
            return {
                action: 'BLOCK',
                message: 'Yêu cầu hủy đơn đã bị shop từ chối, không thể gửi lại yêu cầu hủy',
                code: 'CANCEL_REQUEST_REJECTED',
                statusCode: 400,
            };
        }

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

const hasRejectedCancelRequest = (order) => {
    const history = Array.isArray(order?.statusHistory) ? order.statusHistory : [];
    const lastCancelRequestIndex = history.map((entry) => entry?.status).lastIndexOf('CANCEL_REQUESTED');

    if (lastCancelRequestIndex < 0) {
        return false;
    }

    return history.slice(lastCancelRequestIndex + 1).some((entry) => entry?.status === 'PREPARING');
};

const validateOrderStatus = (status) => {
    const normalizedStatus = normalizeText(status).toUpperCase();

    if (!normalizedStatus) {
        return '';
    }

    const validStatuses = Order.schema.path('status').enumValues;
    if (!validStatuses.includes(normalizedStatus)) {
        throw createServiceError(400, 'Trạng thái đơn hàng không hợp lệ', 'INVALID_ORDER_STATUS', {
            status: normalizedStatus,
            validStatuses,
        });
    }

    return normalizedStatus;
};

const validateAdminNote = (note) => {
    const normalizedNote = normalizeText(note);

    if (normalizedNote.length > 300) {
        throw createServiceError(400, 'Ghi chú không được vượt quá 300 ký tự', 'INVALID_ORDER_NOTE');
    }

    return normalizedNote;
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

        // Trigger Notification for Admin (R1) and Moderator (R3)
        createNotification({
            recipientRole: 'R1',
            type: 'NEW_ORDER',
            title: 'Đơn hàng mới',
            content: `Khách hàng đã đặt đơn hàng ${createdOrder.orderCode} trị giá ${Number(createdOrder.totalAmount).toLocaleString('vi-VN')}đ.`,
            link: `/admin/orders`
        }).catch(err => console.error('Checkout notification error:', err));

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
    const filter = { user: new mongoose.Types.ObjectId(userId) };
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

    const [orders, total, summaryResult] = await Promise.all([
        Order.aggregate([
            { $match: filter },
            {
                $addFields: {
                    userHistoryPriority: {
                        $switch: {
                            branches: Object.entries(USER_HISTORY_STATUS_PRIORITY).map(([status, priority]) => ({
                                case: { $eq: ['$status', status] },
                                then: priority,
                            })),
                            default: 99,
                        },
                    },
                    latestUserActivityAt: {
                        $max: {
                            $concatArrays: [
                                ['$createdAt'],
                                {
                                    $map: {
                                        input: {
                                            $filter: {
                                                input: '$statusHistory',
                                                as: 'history',
                                                cond: { $in: ['$$history.status', USER_ACTIVITY_STATUSES] },
                                            },
                                        },
                                        as: 'history',
                                        in: '$$history.changedAt',
                                    },
                                },
                            ],
                        },
                    },
                },
            },
            { $sort: { userHistoryPriority: 1, latestUserActivityAt: -1, createdAt: -1 } },
            { $skip: paging.skip },
            { $limit: paging.limit },
        ]),
        Order.countDocuments(filter),
        Order.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    status: 'DELIVERED',
                    paymentStatus: 'PAID',
                },
            },
            {
                $group: {
                    _id: null,
                    totalDeliveredOrders: { $sum: 1 },
                    totalDeliveredAmount: { $sum: '$totalAmount' },
                },
            },
        ]),
    ]);
    const summary = summaryResult[0] || { totalDeliveredOrders: 0, totalDeliveredAmount: 0 };

    return {
        items: orders.map(mapOrder),
        pagination: {
            page: paging.page,
            limit: paging.limit,
            total,
            totalPages: Math.ceil(total / paging.limit),
        },
        summary: {
            totalPurchasedOrders: summary.totalDeliveredOrders,
            totalPurchasedAmount: summary.totalDeliveredAmount,
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

export const getAdminOrders = async ({ page, limit, status }) => {
    const paging = normalizePagination({ page, limit });
    const filter = {};
    const normalizedStatus = validateOrderStatus(status);

    await autoConfirmExpiredNewOrders();

    if (normalizedStatus) {
        filter.status = normalizedStatus;
    }

    const [orders, total] = await Promise.all([
        Order.find(filter)
            .populate('user', 'email firstName lastName phoneNumber')
            .sort({ createdAt: -1 })
            .skip(paging.skip)
            .limit(paging.limit)
            .lean(),
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

export const getAdminOrderDetail = async ({ orderIdOrCode }) => {
    const orderKey = normalizeText(orderIdOrCode);
    if (!orderKey) {
        throw createServiceError(400, 'Mã đơn hàng không hợp lệ', 'INVALID_ORDER_KEY');
    }

    await autoConfirmExpiredNewOrders();
    const order = await Order.findOne(getOrderFilter(orderKey))
        .populate('user', 'email firstName lastName phoneNumber')
        .lean();

    if (!order) {
        throw createServiceError(404, 'Không tìm thấy đơn hàng', 'ORDER_NOT_FOUND');
    }

    return mapOrder(order);
};

export const updateAdminOrderStatus = async ({ orderIdOrCode, status, note }) => {
    const orderKey = normalizeText(orderIdOrCode);
    if (!orderKey) {
        throw createServiceError(400, 'Mã đơn hàng không hợp lệ', 'INVALID_ORDER_KEY');
    }

    const nextStatus = validateOrderStatus(status);
    if (!nextStatus) {
        throw createServiceError(400, 'Trạng thái mới không được để trống', 'MISSING_ORDER_STATUS');
    }

    const adminNote = validateAdminNote(note);

    await autoConfirmExpiredNewOrders();
    const order = await Order.findOne(getOrderFilter(orderKey));

    if (!order) {
        throw createServiceError(404, 'Không tìm thấy đơn hàng', 'ORDER_NOT_FOUND');
    }

    if (FINAL_STATUSES.includes(order.status)) {
        throw createServiceError(400, 'Đơn hàng đã hoàn tất hoặc đã hủy, không thể cập nhật trạng thái', 'ORDER_ALREADY_FINALIZED');
    }

    if (order.status === 'CANCEL_REQUESTED') {
        throw createServiceError(400, 'Đơn hàng đang chờ xử lý yêu cầu hủy', 'CANCEL_REQUEST_PENDING');
    }

    const expectedStatus = ADMIN_NEXT_STATUSES[order.status];
    if (nextStatus !== expectedStatus) {
        throw createServiceError(400, 'Chỉ được chuyển đơn hàng sang bước kế tiếp', 'INVALID_ORDER_TRANSITION', {
            currentStatus: order.status,
            allowedNextStatus: expectedStatus || null,
            requestedStatus: nextStatus,
        });
    }

    order.status = nextStatus;
    if (order.paymentMethod === 'COD' && nextStatus === 'DELIVERED') {
        order.paymentStatus = 'PAID';
        order.paymentInfo = {
            ...(order.paymentInfo?.toObject?.() || order.paymentInfo || {}),
            provider: 'COD',
            lastVerifiedAt: new Date(),
        };
    }

    order.statusHistory.push({
        status: nextStatus,
        note: adminNote || (order.paymentMethod === 'COD' && nextStatus === 'DELIVERED'
            ? 'Đã giao hàng và thu tiền COD thành công'
            : ADMIN_STATUS_NOTES[nextStatus] || 'Shop cập nhật trạng thái đơn hàng'),
        changedAt: new Date(),
    });

    await order.save();

    // Trigger Notification for the Customer (User)
    createNotification({
        recipientId: order.user,
        type: 'ORDER_STATUS_UPDATE',
        title: 'Cập nhật trạng thái đơn hàng',
        content: `Đơn hàng ${order.orderCode} của bạn đã chuyển sang trạng thái: ${nextStatus}. Ghi chú: ${adminNote || 'Không có'}`,
        link: `/orders`
    }).catch(err => console.error('Order status update notification error:', err));

    return mapOrder(order);
};

export const resolveAdminCancelRequest = async ({ orderIdOrCode, action, note }) => {
    const orderKey = normalizeText(orderIdOrCode);
    if (!orderKey) {
        throw createServiceError(400, 'Mã đơn hàng không hợp lệ', 'INVALID_ORDER_KEY');
    }

    const normalizedAction = normalizeText(action).toUpperCase();
    if (!['APPROVE', 'REJECT'].includes(normalizedAction)) {
        throw createServiceError(400, 'Hành động xử lý yêu cầu hủy không hợp lệ', 'INVALID_CANCEL_ACTION', {
            validActions: ['APPROVE', 'REJECT'],
        });
    }

    const adminNote = validateAdminNote(note);
    const order = await Order.findOne(getOrderFilter(orderKey));

    if (!order) {
        throw createServiceError(404, 'Không tìm thấy đơn hàng', 'ORDER_NOT_FOUND');
    }

    if (order.status !== 'CANCEL_REQUESTED') {
        throw createServiceError(400, 'Đơn hàng không có yêu cầu hủy đang chờ xử lý', 'ORDER_NOT_CANCEL_REQUESTED');
    }

    if (normalizedAction === 'APPROVE') {
        order.status = 'CANCELLED';
        if (order.paymentStatus === 'PAID') {
            order.paymentStatus = 'REFUND_REQUIRED';
        }
        order.statusHistory.push({
            status: 'CANCELLED',
            note: adminNote || 'Admin chấp nhận yêu cầu hủy đơn',
            changedAt: new Date(),
        });
    } else {
        order.status = 'PREPARING';
        order.statusHistory.push({
            status: 'PREPARING',
            note: adminNote || 'Admin từ chối yêu cầu hủy đơn, tiếp tục chuẩn bị hàng',
            changedAt: new Date(),
        });
    }

    await order.save();

    // Trigger Notification for the Customer (User)
    const actionText = action === 'APPROVE' ? 'được chấp nhận' : 'bị từ chối';
    const statusText = action === 'APPROVE' ? 'Đã hủy' : 'Đang chuẩn bị hàng';
    createNotification({
        recipientId: order.user,
        type: 'ORDER_STATUS_UPDATE',
        title: 'Yêu cầu hủy đơn hàng',
        content: `Yêu cầu hủy đơn hàng ${order.orderCode} của bạn đã ${actionText}. Trạng thái hiện tại: ${statusText}. Ghi chú: ${adminNote || 'Không có'}`,
        link: `/orders`
    }).catch(err => console.error('Cancel request resolution notification error:', err));

    return mapOrder(order);
};

export { OrderServiceError };
