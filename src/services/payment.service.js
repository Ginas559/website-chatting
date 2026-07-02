import mongoose from 'mongoose';
import {
    HashAlgorithm,
    InpOrderAlreadyConfirmed,
    IpnFailChecksum,
    IpnInvalidAmount,
    IpnOrderNotFound,
    IpnSuccess,
    ProductCode,
    VNPay,
    VnpLocale,
    ignoreLogger,
} from 'vnpay';
import Order from '../models/order.model.js';
import { createNotification } from '../utils/notification';
import {
    applyStockForOrderItems,
    buildOrderDraftFromCart,
    clearOrderedItemsFromCart,
    mapOrder,
    normalizeText,
} from './checkout.helper.js';

const VNPAY_PROVIDER = 'VNPAY';

class PaymentServiceError extends Error {
    constructor(statusCode, message, code = 'PAYMENT_ERROR', details = null) {
        super(message);
        this.name = 'PaymentServiceError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isPaymentServiceError = true;
    }
}

const createServiceError = (statusCode, message, code = 'PAYMENT_ERROR', details = null) => {
    return new PaymentServiceError(statusCode, message, code, details);
};

const getRequiredEnv = (key) => {
    const value = normalizeText(process.env[key]);

    if (!value) {
        throw createServiceError(500, `Thiếu cấu hình ${key}`, 'MISSING_VNPAY_CONFIG', { key });
    }

    return value;
};

const resolveVnpayEndpointConfig = () => {
    const rawUrl = getRequiredEnv('VNPAY_URL');

    try {
        const url = new URL(rawUrl);
        const paymentEndpoint = url.pathname.replace(/^\/+/, '') || 'paymentv2/vpcpay.html';

        return {
            vnpayHost: url.origin,
            paymentEndpoint,
        };
    } catch (error) {
        throw createServiceError(500, 'VNPAY_URL không hợp lệ', 'INVALID_VNPAY_URL', { value: rawUrl });
    }
};

const getVnpayClient = () => {
    const { vnpayHost, paymentEndpoint } = resolveVnpayEndpointConfig();

    return new VNPay({
        tmnCode: getRequiredEnv('VNPAY_TMN_CODE'),
        secureSecret: getRequiredEnv('VNPAY_HASH_SECRET'),
        vnpayHost,
        testMode: true,
        hashAlgorithm: HashAlgorithm.SHA512,
        enableLog: false,
        loggerFn: ignoreLogger,
        endpoints: {
            paymentEndpoint,
        },
    });
};

const generateVnpayOrderCode = () => {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).slice(2, 10).toUpperCase();

    return `VNP${datePart}${randomPart}`;
};

const buildPaymentInfoFromVerifyResult = (verifyResult) => {
    return {
        provider: VNPAY_PROVIDER,
        transactionNo: normalizeText(verifyResult.vnp_TransactionNo),
        bankCode: normalizeText(verifyResult.vnp_BankCode),
        cardType: normalizeText(verifyResult.vnp_CardType),
        responseCode: normalizeText(verifyResult.vnp_ResponseCode),
        transactionStatus: normalizeText(verifyResult.vnp_TransactionStatus),
        payDate: normalizeText(verifyResult.vnp_PayDate),
        lastVerifiedAt: new Date(),
    };
};

const sameAmount = (orderAmount, vnpayAmount) => {
    return Number(orderAmount) === Number(vnpayAmount);
};

const markOrderPaymentFailed = async (order, verifyResult, session) => {
    order.paymentStatus = 'FAILED';
    order.status = 'CANCELLED';
    order.paymentInfo = buildPaymentInfoFromVerifyResult(verifyResult);
    order.statusHistory.push({
        status: 'CANCELLED',
        note: 'Thanh toán VNPay không thành công',
        changedAt: new Date(),
    });

    await order.save({ session });
};

const markOrderRefundRequired = async (order, verifyResult, note, session) => {
    order.paymentStatus = 'REFUND_REQUIRED';
    order.status = 'CANCELLED';
    order.paymentInfo = buildPaymentInfoFromVerifyResult(verifyResult);
    order.statusHistory.push({
        status: 'CANCELLED',
        note,
        changedAt: new Date(),
    });

    await order.save({ session });
};

const confirmPaidOrder = async (order, verifyResult, session) => {
    try {
        await applyStockForOrderItems(order.items, session, createServiceError);
    } catch (error) {
        if (!error.isPaymentServiceError || error.code !== 'PRODUCT_CHANGED') {
            throw error;
        }

        await markOrderRefundRequired(
            order,
            verifyResult,
            'Thanh toán VNPay thành công nhưng sản phẩm đã thay đổi giá hoặc không đủ tồn kho, cần xử lý hoàn tiền',
            session
        );
        return;
    }

    order.paymentStatus = 'PAID';
    order.status = 'NEW';
    order.paymentInfo = buildPaymentInfoFromVerifyResult(verifyResult);
    order.statusHistory.push({
        status: 'NEW',
        note: 'Thanh toán VNPay thành công, đơn hàng mới được tạo',
        changedAt: new Date(),
    });

    await order.save({ session });
    await clearOrderedItemsFromCart(order.user, order.items, session);

    // Trigger notification for Admin (R1) and Manager (R3)
    createNotification({
        recipientRole: 'R1',
        type: 'NEW_ORDER',
        title: 'Đơn hàng mới (VNPay)',
        content: `Đơn hàng ${order.orderCode} trị giá ${Number(order.totalAmount).toLocaleString('vi-VN')}đ đã được thanh toán qua VNPay thành công.`,
        link: `/admin/orders`
    }).catch(err => console.error('VNPay checkout notification error:', err));
};

const buildVnpayPaymentUrl = ({ order, ipAddr, bankCode }) => {
    const vnpay = getVnpayClient();
    const returnUrl = getRequiredEnv('VNPAY_RETURN_URL');

    return vnpay.buildPaymentUrl({
        vnp_Amount: order.totalAmount,
        vnp_IpAddr: normalizeText(ipAddr) || '127.0.0.1',
        vnp_ReturnUrl: returnUrl,
        vnp_TxnRef: order.orderCode,
        vnp_OrderInfo: `Thanh toan don hang ${order.orderCode}`,
        vnp_OrderType: ProductCode.Other,
        vnp_Locale: VnpLocale.VN,
        vnp_BankCode: normalizeText(bankCode) || undefined,
    });
};

export const createVnpayPaymentFromCart = async ({ userId, shippingInfo, selectedProductIds, ipAddr, bankCode }) => {
    const session = await mongoose.startSession();

    try {
        let createdOrder = null;

        await session.withTransaction(async () => {
            const orderDraft = await buildOrderDraftFromCart({
                userId,
                shippingInfo,
                selectedProductIds,
                session,
                createServiceError,
            });

            const [order] = await Order.create(
                [
                    {
                        orderCode: generateVnpayOrderCode(),
                        user: userId,
                        items: orderDraft.orderItems,
                        shippingInfo: orderDraft.shippingInfo,
                        subtotal: orderDraft.subtotal,
                        shippingFee: orderDraft.shippingFee,
                        totalAmount: orderDraft.totalAmount,
                        paymentMethod: VNPAY_PROVIDER,
                        paymentStatus: 'UNPAID',
                        paymentInfo: { provider: VNPAY_PROVIDER },
                        status: 'PENDING_PAYMENT',
                        statusHistory: [{ status: 'PENDING_PAYMENT', note: 'Đơn hàng đang chờ thanh toán VNPay', changedAt: new Date() }],
                    },
                ],
                { session }
            );

            createdOrder = order;
        });

        const paymentUrl = buildVnpayPaymentUrl({ order: createdOrder, ipAddr, bankCode });

        return {
            order: mapOrder(createdOrder),
            paymentUrl,
        };
    } finally {
        await session.endSession();
    }
};

export const createVnpayPaymentForExistingOrder = async ({ userId, orderIdOrCode, ipAddr, bankCode }) => {
    const orderKey = normalizeText(orderIdOrCode);

    if (!mongoose.isValidObjectId(userId)) {
        throw createServiceError(400, 'Người dùng không hợp lệ', 'INVALID_OBJECT_ID');
    }

    if (!orderKey) {
        throw createServiceError(400, 'Mã đơn hàng không hợp lệ', 'INVALID_ORDER_KEY');
    }

    const filter = { user: userId, paymentMethod: VNPAY_PROVIDER };

    if (mongoose.isValidObjectId(orderKey)) {
        filter._id = orderKey;
    } else {
        filter.orderCode = orderKey.toUpperCase();
    }

    const order = await Order.findOne(filter);

    if (!order) {
        throw createServiceError(404, 'Không tìm thấy đơn hàng VNPay', 'ORDER_NOT_FOUND');
    }

    if (order.paymentStatus !== 'UNPAID' || order.status !== 'PENDING_PAYMENT') {
        throw createServiceError(400, 'Đơn hàng hiện tại không thể thanh toán lại', 'ORDER_CANNOT_REPAY', {
            status: order.status,
            paymentStatus: order.paymentStatus,
        });
    }

    if (order.paymentInfo?.returnVerifiedSuccess) {
        throw createServiceError(409, 'Giao dịch đã được VNPay ghi nhận, vui lòng chờ hệ thống xác nhận', 'PAYMENT_CONFIRMATION_PENDING');
    }

    return {
        order: mapOrder(order),
        paymentUrl: buildVnpayPaymentUrl({ order, ipAddr, bankCode }),
    };
};

export const handleVnpayIpn = async (query = {}) => {
    const vnpay = getVnpayClient();
    const verifyResult = vnpay.verifyIpnCall(query);

    if (!verifyResult.isVerified) {
        return IpnFailChecksum;
    }

    const orderCode = normalizeText(verifyResult.vnp_TxnRef);
    const order = await Order.findOne({ orderCode, paymentMethod: VNPAY_PROVIDER });

    if (!order) {
        return IpnOrderNotFound;
    }

    if (!sameAmount(order.totalAmount, verifyResult.vnp_Amount)) {
        return IpnInvalidAmount;
    }

    if (order.paymentStatus !== 'UNPAID' || order.status !== 'PENDING_PAYMENT') {
        return InpOrderAlreadyConfirmed;
    }

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const lockedOrder = await Order.findOne({ _id: order._id }).session(session);

            if (!lockedOrder || lockedOrder.paymentStatus !== 'UNPAID' || lockedOrder.status !== 'PENDING_PAYMENT') {
                return;
            }

            if (!verifyResult.isSuccess) {
                await markOrderPaymentFailed(lockedOrder, verifyResult, session);
                return;
            }

            await confirmPaidOrder(lockedOrder, verifyResult, session);
        });

        return IpnSuccess;
    } finally {
        await session.endSession();
    }
};

export const verifyVnpayReturn = async (query = {}) => {
    const vnpay = getVnpayClient();
    const verifyResult = vnpay.verifyReturnUrl(query);

    const result = {
        isVerified: verifyResult.isVerified,
        isSuccess: verifyResult.isSuccess,
        message: verifyResult.message,
        orderCode: normalizeText(verifyResult.vnp_TxnRef),
        amount: Number(verifyResult.vnp_Amount || 0),
        responseCode: normalizeText(verifyResult.vnp_ResponseCode),
        transactionStatus: normalizeText(verifyResult.vnp_TransactionStatus),
        transactionNo: normalizeText(verifyResult.vnp_TransactionNo),
        bankCode: normalizeText(verifyResult.vnp_BankCode),
        payDate: normalizeText(verifyResult.vnp_PayDate),
    };

    if (result.isVerified && result.orderCode) {
        const order = await Order.findOne({ orderCode: result.orderCode, paymentMethod: VNPAY_PROVIDER });

        if (order && sameAmount(order.totalAmount, result.amount) && order.paymentStatus === 'UNPAID' && order.status === 'PENDING_PAYMENT') {
            const currentPaymentInfo = order.paymentInfo?.toObject?.() || order.paymentInfo || {};
            order.paymentInfo = {
                ...currentPaymentInfo,
                ...buildPaymentInfoFromVerifyResult(verifyResult),
                returnVerifiedSuccess: result.isSuccess,
                returnVerifiedAt: new Date(),
            };

            await order.save();
        }
    }

    return result;
};

export { PaymentServiceError };
