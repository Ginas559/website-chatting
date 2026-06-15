import crypto from 'crypto';
import mongoose from 'mongoose';
import Order from '../models/order.model.js';
import User from '../models/user';
import { applyStockForOrderItems, buildOrderDraftFromCart, clearCart, mapOrder, normalizeText } from './checkout.helper.js';
import { createNotification } from '../utils/notification';
import { recordDeliveredOrderRevenue } from './wallet.service';
import { layKetQuaRuiRoAnToan } from './orderRisk.service';

const DEFAULT_PAYMENT_METHOD = 'COD';
const SUPPORTED_PAYMENT_METHODS = ['COD'];
const DELIVERY_QR_PREFIX = 'SZD1.';
const DELIVERY_QR_TTL_DAYS = 30;
const DELIVERY_QR_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const DELIVERY_QR_CREATABLE_STATUSES = ['SHIPPING', 'DELIVERED'];
const DELIVERY_QR_CIPHER = 'aes-256-gcm';

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

const hashDeliveryToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

const getDeliveryEncryptionKey = () => {
    const secret = normalizeText(process.env.DELIVERY_QR_ENCRYPTION_SECRET || process.env.JWT_SECRET);

    if (!secret) {
        throw createServiceError(500, 'Hệ thống chưa cấu hình khóa mã hóa QR', 'DELIVERY_QR_ENCRYPTION_NOT_CONFIGURED');
    }

    return crypto.createHash('sha256').update(secret).digest();
};

const encryptDeliveryToken = (token) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(DELIVERY_QR_CIPHER, getDeliveryEncryptionKey(), iv);
    const encryptedToken = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);

    return {
        encryptedToken: encryptedToken.toString('base64'),
        encryptionIv: iv.toString('base64'),
        encryptionAuthTag: cipher.getAuthTag().toString('base64'),
    };
};

const decryptDeliveryToken = (verification) => {
    try {
        const decipher = crypto.createDecipheriv(
            DELIVERY_QR_CIPHER,
            getDeliveryEncryptionKey(),
            Buffer.from(verification.encryptionIv, 'base64')
        );
        decipher.setAuthTag(Buffer.from(verification.encryptionAuthTag, 'base64'));

        return Buffer.concat([
            decipher.update(Buffer.from(verification.encryptedToken, 'base64')),
            decipher.final(),
        ]).toString('utf8');
    } catch {
        throw createServiceError(500, 'Không thể giải mã QR hiện tại', 'DELIVERY_QR_DECRYPT_FAILED');
    }
};

const selectDeliveryQrSecrets = (query) => {
    return query.select([
        '+deliveryVerification.tokenHash',
        '+deliveryVerification.encryptedToken',
        '+deliveryVerification.encryptionIv',
        '+deliveryVerification.encryptionAuthTag',
    ].join(' '));
};

const mapAdminDeliveryQr = (order, token) => ({
    orderCode: order.orderCode,
    qrContent: `${DELIVERY_QR_PREFIX}${token}`,
    status: getDeliveryQrSummary(order).status,
    generatedAt: order.deliveryVerification.generatedAt,
    expiresAt: order.deliveryVerification.expiresAt,
    notice: 'QR chỉ dùng để đối chiếu kiện hàng, không chứng minh sản phẩm vật lý bên trong là chính hãng hoặc nguyên vẹn.',
});

const parseDeliveryQrContent = (value) => {
    const qrContent = normalizeText(value);

    if (!qrContent.startsWith(DELIVERY_QR_PREFIX)) {
        throw createServiceError(400, 'QR không đúng định dạng của SmartZone', 'INVALID_DELIVERY_QR');
    }

    const token = qrContent.slice(DELIVERY_QR_PREFIX.length);
    if (!DELIVERY_QR_TOKEN_PATTERN.test(token)) {
        throw createServiceError(400, 'QR không hợp lệ hoặc đã bị thay đổi', 'INVALID_DELIVERY_QR');
    }

    return token.toLowerCase();
};

const getDeliveryQrSummary = (order) => {
    const verification = order?.deliveryVerification || {};

    if (!verification.generatedAt || !verification.expiresAt) {
        return {
            status: 'NOT_CREATED',
            generatedAt: null,
            expiresAt: null,
            lastVerifiedAt: null,
            verificationCount: 0,
        };
    }

    if (verification.tokenHash && !verification.encryptedToken) {
        return {
            status: 'LEGACY',
            generatedAt: verification.generatedAt,
            expiresAt: verification.expiresAt,
            lastVerifiedAt: verification.lastVerifiedAt || null,
            verificationCount: Number(verification.verificationCount || 0),
        };
    }

    const isRevoked = Boolean(verification.revokedAt);
    const isExpired = new Date(verification.expiresAt).getTime() <= Date.now();

    return {
        status: isRevoked ? 'REVOKED' : isExpired ? 'EXPIRED' : 'ACTIVE',
        generatedAt: verification.generatedAt,
        expiresAt: verification.expiresAt,
        lastVerifiedAt: verification.lastVerifiedAt || null,
        verificationCount: Number(verification.verificationCount || 0),
    };
};

const maskPhoneNumber = (value) => {
    const phone = normalizeText(value);

    if (phone.length <= 3) {
        return '*'.repeat(phone.length);
    }

    return `${'*'.repeat(phone.length - 3)}${phone.slice(-3)}`;
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
const FINAL_STATUSES = ['CANCELLED', 'DELIVERED', 'DELIVERY_FAILED'];
const AUTO_CONFIRM_AFTER_MINUTES = 30;
const ADMIN_ALLOWED_TRANSITIONS = {
    NEW: ['CONFIRMED'],
    CONFIRMED: ['PREPARING'],
    PREPARING: ['SHIPPING'],
    SHIPPING: ['DELIVERED', 'DELIVERY_FAILED'],
    DELIVERED: [],
    DELIVERY_FAILED: [],
    CANCELLED: [],
    CANCEL_REQUESTED: [],
};
const ADMIN_STATUS_NOTES = {
    CONFIRMED: 'Shop đã xác nhận đơn hàng của bạn',
    PREPARING: 'Shop đang chuẩn bị hàng cho đơn hàng của bạn',
    SHIPPING: 'Đơn hàng đã được bàn giao cho đơn vị vận chuyển',
    DELIVERED: 'Đơn hàng đã được giao thành công',
    DELIVERY_FAILED: 'Đơn hàng giao thất bại',
};
const USER_ACTIVITY_STATUSES = ['CANCELLED', 'CANCEL_REQUESTED', 'DELIVERY_FAILED'];
const USER_HISTORY_STATUS_PRIORITY = {
    CANCEL_REQUESTED: 0,
    NEW: 1,
    CANCELLED: 2,
    CONFIRMED: 3,
    PREPARING: 4,
    PENDING_PAYMENT: 5,
    SHIPPING: 6,
    DELIVERED: 7,
    DELIVERY_FAILED: 8,
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

const validateRiskLevel = (riskLevel) => {
    const normalizedRiskLevel = normalizeText(riskLevel).toUpperCase();

    if (!normalizedRiskLevel) {
        return '';
    }

    if (!['LOW', 'MEDIUM', 'HIGH'].includes(normalizedRiskLevel)) {
        throw createServiceError(400, 'Mức rủi ro không hợp lệ', 'INVALID_RISK_LEVEL', {
            riskLevel: normalizedRiskLevel,
            validRiskLevels: ['LOW', 'MEDIUM', 'HIGH'],
        });
    }

    return normalizedRiskLevel;
};

const validateAdminStatusTransition = (currentStatus, nextStatus) => {
    const allowedNextStatuses = ADMIN_ALLOWED_TRANSITIONS[currentStatus] || [];

    if (allowedNextStatuses.includes(nextStatus)) {
        return;
    }

    if (nextStatus === 'DELIVERY_FAILED') {
        throw createServiceError(400, 'Chỉ đơn đang giao mới có thể đánh dấu giao thất bại', 'DELIVERY_FAILED_ONLY_FROM_SHIPPING', {
            currentStatus,
            allowedNextStatuses,
            requestedStatus: nextStatus,
        });
    }

    throw createServiceError(400, 'Chỉ được chuyển đơn hàng sang bước kế tiếp', 'INVALID_ORDER_TRANSITION', {
        currentStatus,
        allowedNextStatuses,
        requestedStatus: nextStatus,
    });
};

const escapeRegExp = (value) => normalizeText(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const mapAdminOrder = (order) => {
    const mappedOrder = mapOrder(order);
    const user = order?.user || {};
    const customerName = `${user.firstName || ''} ${user.lastName || ''}`.trim()
        || user.email
        || order?.shippingInfo?.fullName
        || '-';

    return {
        ...mappedOrder,
        _id: order._id,
        userId: order.user,
        customerName,
    };
};

const validateAdminNote = (note) => {
    const normalizedNote = normalizeText(note);

    if (normalizedNote.length > 300) {
        throw createServiceError(400, 'Ghi chú không được vượt quá 300 ký tự', 'INVALID_ORDER_NOTE');
    }

    return normalizedNote;
};

export const checkoutOrder = async ({ userId, shippingInfo, paymentMethod, shippingDistanceKm }) => {
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
            const ketQuaRuiRo = await layKetQuaRuiRoAnToan({
                userId,
                orderAmount: orderDraft.totalAmount,
                shippingDistanceKm,
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
                        riskScore: ketQuaRuiRo.riskScore,
                        riskLevel: ketQuaRuiRo.riskLevel,
                        riskReasons: ketQuaRuiRo.riskReasons,
                        isSuspicious: ketQuaRuiRo.isSuspicious,
                        fraudProbability: ketQuaRuiRo.fraudProbability,
                        riskSource: ketQuaRuiRo.riskSource,
                    },
                ],
                { session }
            );

            await clearCart(orderDraft.cart, session);
            createdOrder = order;
        });

        // Trigger Notification for Admin (R1) and Manager (R3)
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

export const getAdminOrders = async ({ page, limit, status, keyword, riskLevel, isSuspicious }) => {
    const paging = normalizePagination({ page, limit });
    const filter = {};
    const andConditions = [];
    const normalizedStatus = validateOrderStatus(status);
    const normalizedRiskLevel = validateRiskLevel(riskLevel);
    const normalizedKeyword = escapeRegExp(keyword);

    await autoConfirmExpiredNewOrders();

    if (normalizedStatus) {
        filter.status = normalizedStatus;
    }

    if (normalizedRiskLevel === 'LOW') {
        andConditions.push({
            $or: [
                { riskLevel: 'LOW' },
                { riskLevel: { $exists: false } },
                { riskLevel: null },
            ],
        });
    } else if (normalizedRiskLevel) {
        filter.riskLevel = normalizedRiskLevel;
    }

    if (String(isSuspicious).toLowerCase() === 'true') {
        filter.isSuspicious = true;
    }

    if (normalizedKeyword) {
        const matchedUsers = await User.find({
            $or: [
                { firstName: { $regex: normalizedKeyword, $options: 'i' } },
                { lastName: { $regex: normalizedKeyword, $options: 'i' } },
                { email: { $regex: normalizedKeyword, $options: 'i' } },
                { phoneNumber: { $regex: normalizedKeyword, $options: 'i' } },
            ],
        }).select('_id').lean();

        andConditions.push({
            $or: [
                { orderCode: { $regex: normalizedKeyword, $options: 'i' } },
                { 'shippingInfo.fullName': { $regex: normalizedKeyword, $options: 'i' } },
                { 'shippingInfo.phone': { $regex: normalizedKeyword, $options: 'i' } },
                { user: { $in: matchedUsers.map((item) => item._id) } },
            ],
        });
    }

    if (andConditions.length) {
        filter.$and = andConditions;
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
        items: orders.map(mapAdminOrder),
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
    const order = await selectDeliveryQrSecrets(
        Order.findOne(getOrderFilter(orderKey))
            .populate('user', 'email firstName lastName phoneNumber')
    ).lean();

    if (!order) {
        throw createServiceError(404, 'Không tìm thấy đơn hàng', 'ORDER_NOT_FOUND');
    }

    return {
        ...mapOrder(order),
        deliveryQr: getDeliveryQrSummary(order),
    };
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

    validateAdminStatusTransition(order.status, nextStatus);

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

    if (order.status === 'DELIVERED' && order.paymentStatus === 'PAID') {
        await recordDeliveredOrderRevenue(order);
    }

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

export const createAdminDeliveryQr = async ({ orderIdOrCode }) => {
    const orderKey = normalizeText(orderIdOrCode);
    if (!orderKey) {
        throw createServiceError(400, 'Mã đơn hàng không hợp lệ', 'INVALID_ORDER_KEY');
    }

    const order = await selectDeliveryQrSecrets(Order.findOne(getOrderFilter(orderKey)));

    if (!order) {
        throw createServiceError(404, 'Không tìm thấy đơn hàng', 'ORDER_NOT_FOUND');
    }

    if (!DELIVERY_QR_CREATABLE_STATUSES.includes(order.status)) {
        throw createServiceError(400, 'Chỉ có thể tạo QR khi đơn hàng đang giao hoặc đã giao', 'DELIVERY_QR_STATUS_NOT_ALLOWED', {
            currentStatus: order.status,
            allowedStatuses: DELIVERY_QR_CREATABLE_STATUSES,
        });
    }

    const currentVerification = order.deliveryVerification || {};
    if (currentVerification.tokenHash) {
        if (!currentVerification.encryptedToken || !currentVerification.encryptionIv || !currentVerification.encryptionAuthTag) {
            throw createServiceError(
                409,
                'QR cũ được tạo trước phiên bản lưu trữ an toàn và không thể xem lại. Chỉ tạo lại sau khi chắc chắn tem cũ chưa được gửi đi',
                'DELIVERY_QR_LEGACY_TOKEN'
            );
        }

        return mapAdminDeliveryQr(order, decryptDeliveryToken(currentVerification));
    }

    const token = crypto.randomBytes(32).toString('hex');
    const generatedAt = new Date();
    const expiresAt = new Date(generatedAt.getTime() + DELIVERY_QR_TTL_DAYS * 24 * 60 * 60 * 1000);
    const encryptedToken = encryptDeliveryToken(token);

    order.deliveryVerification = {
        tokenHash: hashDeliveryToken(token),
        ...encryptedToken,
        generatedAt,
        expiresAt,
        revokedAt: null,
        lastVerifiedAt: null,
        verificationCount: 0,
    };

    await order.save();

    return mapAdminDeliveryQr(order, token);
};

export const getAdminDeliveryQr = async ({ orderIdOrCode }) => {
    const orderKey = normalizeText(orderIdOrCode);
    if (!orderKey) {
        throw createServiceError(400, 'Mã đơn hàng không hợp lệ', 'INVALID_ORDER_KEY');
    }

    const order = await selectDeliveryQrSecrets(Order.findOne(getOrderFilter(orderKey)));
    if (!order) {
        throw createServiceError(404, 'Không tìm thấy đơn hàng', 'ORDER_NOT_FOUND');
    }

    const verification = order.deliveryVerification || {};
    if (!verification.tokenHash) {
        throw createServiceError(404, 'Đơn hàng chưa có QR kiện hàng', 'DELIVERY_QR_NOT_CREATED');
    }

    if (!verification.encryptedToken || !verification.encryptionIv || !verification.encryptionAuthTag) {
        throw createServiceError(409, 'QR hiện tại không thể khôi phục từ phiên bản dữ liệu cũ', 'DELIVERY_QR_LEGACY_TOKEN');
    }

    return mapAdminDeliveryQr(order, decryptDeliveryToken(verification));
};

export const verifyMyDeliveryQr = async ({ userId, qrContent }) => {
    if (!mongoose.isValidObjectId(userId)) {
        throw createServiceError(400, 'Người dùng không hợp lệ', 'INVALID_OBJECT_ID');
    }

    const token = parseDeliveryQrContent(qrContent);
    const tokenHash = hashDeliveryToken(token);
    const order = await Order.findOne({ 'deliveryVerification.tokenHash': tokenHash })
        .select('+deliveryVerification.tokenHash')
        .lean();

    if (!order) {
        throw createServiceError(404, 'Không thể xác minh kiện hàng. QR không hợp lệ, đã bị thay đổi hoặc đã bị vô hiệu hóa', 'DELIVERY_QR_NOT_FOUND');
    }

    if (String(order.user) !== String(userId)) {
        throw createServiceError(403, 'QR không khớp với bất kỳ đơn hàng nào của tài khoản này', 'DELIVERY_QR_OWNER_MISMATCH');
    }

    const verification = order.deliveryVerification || {};
    if (verification.revokedAt) {
        throw createServiceError(410, 'QR của kiện hàng đã bị vô hiệu hóa', 'DELIVERY_QR_REVOKED');
    }

    if (!verification.expiresAt || new Date(verification.expiresAt).getTime() <= Date.now()) {
        throw createServiceError(410, 'QR của kiện hàng đã hết hạn, vui lòng liên hệ SmartZone', 'DELIVERY_QR_EXPIRED');
    }

    if (order.status === 'CANCELLED') {
        throw createServiceError(409, 'Đơn hàng đã bị hủy. Không nên thanh toán hoặc nhận kiện hàng này', 'DELIVERY_ORDER_CANCELLED');
    }

    const isShipping = order.status === 'SHIPPING';
    const isDelivered = order.status === 'DELIVERED';

    if (!isShipping && !isDelivered) {
        throw createServiceError(409, 'Đơn hàng không ở trạng thái giao hàng. Vui lòng liên hệ SmartZone trước khi nhận kiện', 'DELIVERY_ORDER_STATUS_MISMATCH', {
            currentStatus: order.status,
        });
    }

    await Order.updateOne(
        { _id: order._id, 'deliveryVerification.tokenHash': tokenHash },
        {
            $set: { 'deliveryVerification.lastVerifiedAt': new Date() },
            $inc: { 'deliveryVerification.verificationCount': 1 },
        }
    );

    return {
        verificationLevel: isShipping ? 'VERIFIED' : 'REVIEW',
        message: isShipping
            ? 'QR hợp lệ và kiện hàng khớp với đơn đang giao của bạn'
            : 'QR hợp lệ và đúng đơn của bạn, nhưng đơn đã được hệ thống ghi nhận là đã giao',
        order: {
            orderCode: order.orderCode,
            items: order.items,
            totalAmount: order.totalAmount,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            status: order.status,
            shippingInfo: {
                fullName: order.shippingInfo?.fullName || '',
                maskedPhone: maskPhoneNumber(order.shippingInfo?.phone),
                city: order.shippingInfo?.city || '',
            },
        },
        notice: 'QR chỉ xác nhận kiện hàng được liên kết với đơn trên SmartZone. Hãy kiểm tra niêm phong và sản phẩm thực tế trước khi nhận.',
    };
};

export { OrderServiceError };
