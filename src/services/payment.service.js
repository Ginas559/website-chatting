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
import User from '../models/user.js';
import Voucher from '../models/voucher.model.js';
import { createNotification } from '../utils/notification';
import {
    applyStockForOrderItems,
    buildOrderDraftFromCart,
    clearOrderedItemsFromCart,
    mapOrder,
    normalizeText,
    refundOrderDiscounts,
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

    // Tien - Hoàn trả điểm tích lũy và voucher khi thanh toán thất bại
    await refundOrderDiscounts({ order, userId: order.user, session });
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

    // Tien - Hoàn trả điểm tích lũy và voucher khi có lỗi cần hoàn tiền
    await refundOrderDiscounts({ order, userId: order.user, session });
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
        link: `/admin/orders?code=${order.orderCode}`
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

export const createVnpayPaymentFromCart = async ({ userId, shippingInfo, ipAddr, bankCode, couponCode, usePoints, itemIds }) => {
    const session = await mongoose.startSession();

    try {
        let createdOrder = null;

        await session.withTransaction(async () => {
            const orderDraft = await buildOrderDraftFromCart({
                userId,
                shippingInfo,
                itemIds,
                session,
                createServiceError,
            });

            const subtotal = orderDraft.subtotal;
            const shippingFee = orderDraft.shippingFee;
            let couponDiscount = 0;
            let pointsDiscount = 0;
            let pointsUsed = 0;
            const now = new Date();

            // Tien - Kiểm tra và áp dụng mã giảm giá cho VNPAY
            const cleanCouponCode = String(couponCode || '').trim().toUpperCase();
            if (cleanCouponCode) {
                const user = await User.findById(userId).session(session);
                const userCoupon = (user?.rewardCoupons || []).find(
                    c => c.code === cleanCouponCode && !c.isUsed && new Date(c.expiresAt) > now
                );

                if (userCoupon) {
                    if (subtotal < userCoupon.minOrderAmount) {
                        throw createServiceError(400, `Đơn hàng chưa đạt giá trị tối thiểu ${userCoupon.minOrderAmount.toLocaleString('vi-VN')}đ để dùng mã này`, 'MIN_ORDER_AMOUNT_NOT_MET');
                    }
                    couponDiscount = Math.round((subtotal * userCoupon.discountPercent) / 100);

                    await User.updateOne(
                        { _id: userId, 'rewardCoupons.code': cleanCouponCode },
                        { $set: { 'rewardCoupons.$.isUsed': true, 'rewardCoupons.$.usedAt': now } },
                        { session }
                    );
                } else {
                    const systemVoucher = await Voucher.findOne({
                        code: cleanCouponCode,
                        isActive: true,
                        startDate: { $lte: now },
                        endDate: { $gte: now }
                    }).session(session);

                    if (!systemVoucher) {
                        throw createServiceError(400, 'Mã giảm giá không tồn tại hoặc đã hết hạn', 'VOUCHER_INVALID');
                    }

                    if (subtotal < systemVoucher.minOrderAmount) {
                        throw createServiceError(400, `Đơn hàng chưa đạt giá trị tối thiểu ${systemVoucher.minOrderAmount.toLocaleString('vi-VN')}đ để dùng mã này`, 'MIN_ORDER_AMOUNT_NOT_MET');
                    }

                    if (systemVoucher.usedCount >= systemVoucher.usageLimit) {
                        throw createServiceError(400, 'Mã giảm giá đã hết lượt sử dụng', 'VOUCHER_OUT_OF_STOCK');
                    }

                    const alreadyUsed = await Order.findOne({
                        user: userId,
                        couponCode: cleanCouponCode,
                        status: { $ne: 'CANCELLED' }
                    }).session(session).lean();

                    if (alreadyUsed) {
                        throw createServiceError(400, 'Bạn đã sử dụng mã giảm giá này cho đơn hàng khác rồi', 'VOUCHER_ALREADY_USED');
                    }

                    if (systemVoucher.discountType === 'PERCENT') {
                        couponDiscount = Math.round((subtotal * systemVoucher.discountValue) / 100);
                        if (systemVoucher.maxDiscountAmount > 0) {
                            couponDiscount = Math.min(couponDiscount, systemVoucher.maxDiscountAmount);
                        }
                    } else if (systemVoucher.discountType === 'AMOUNT') {
                        couponDiscount = systemVoucher.discountValue;
                    }

                    systemVoucher.usedCount += 1;
                    await systemVoucher.save({ session });
                }
            }

            // Tien - Kiểm tra và áp dụng điểm tích lũy cho VNPAY
            if (usePoints) {
                const user = await User.findById(userId).session(session);
                const userPoints = user?.rewardPoints || 0;

                if (userPoints > 0) {
                    const rate = 1000;
                    const remainingAmount = subtotal + shippingFee - couponDiscount;
                    const maxPointsDiscount = Math.max(0, remainingAmount);
                    const potentialPointsDiscount = userPoints * rate;

                    if (potentialPointsDiscount <= maxPointsDiscount) {
                        pointsDiscount = potentialPointsDiscount;
                        pointsUsed = userPoints;
                    } else {
                        pointsDiscount = maxPointsDiscount;
                        pointsUsed = Math.ceil(maxPointsDiscount / rate);
                    }

                    await User.updateOne(
                        { _id: userId },
                        { $inc: { rewardPoints: -pointsUsed } },
                        { session }
                    );
                }
            }

            const discountAmount = couponDiscount + pointsDiscount;
            const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount);

            const [order] = await Order.create(
                [
                    {
                        orderCode: generateVnpayOrderCode(),
                        user: userId,
                        items: orderDraft.orderItems,
                        shippingInfo: orderDraft.shippingInfo,
                        subtotal,
                        shippingFee,
                        discountAmount,
                        couponCode: cleanCouponCode,
                        couponDiscount,
                        pointsUsed,
                        pointsDiscount,
                        totalAmount,
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

            // Tien - Cập nhật trực tiếp trạng thái thanh toán khi nhận được URL Return đã verify thành công (dự phòng khi IPN không thể gọi đến do ngrok hoặc local)
            if (result.isSuccess) {
                const session = await mongoose.startSession();
                try {
                    await session.withTransaction(async () => {
                        const lockedOrder = await Order.findOne({ _id: order._id }).session(session);
                        if (lockedOrder && lockedOrder.paymentStatus === 'UNPAID' && lockedOrder.status === 'PENDING_PAYMENT') {
                            await confirmPaidOrder(lockedOrder, verifyResult, session);
                        }
                    });
                } catch (error) {
                    console.error('[VNPAY Return fallback] Lỗi xác nhận đơn hàng:', error);
                } finally {
                    await session.endSession();
                }
            }
        }
    }

    return result;
};

// Tien - Thực hiện gọi API hoàn tiền (Refund) của VNPAY
export const refundVnpayPayment = async ({ order, ipAddr, createdBy }) => {
    try {
        const vnpay = getVnpayClient();
        const transactionNo = order.paymentInfo?.transactionNo;
        const payDate = order.paymentInfo?.payDate;

        if (!transactionNo || !payDate) {
            console.warn(`[VNPAY Refund] Đơn hàng ${order.orderCode} thiếu thông tin transactionNo hoặc payDate để hoàn tiền tự động.`);
            return { success: false, code: 'MISSING_TRANSACTION_INFO' };
        }

        const refundResult = await vnpay.refund({
            vnp_TxnRef: order.orderCode,
            vnp_Amount: order.totalAmount,
            vnp_TransactionType: '02', // Hoàn tiền toàn phần
            vnp_TransactionNo: Number(transactionNo),
            vnp_TransactionDate: Number(payDate),
            vnp_CreateBy: createdBy || 'Admin',
            vnp_IpAddr: ipAddr || '127.0.0.1',
            vnp_OrderInfo: `Hoan tra don hang ${order.orderCode} do huy don`,
        });

        console.log(`[VNPAY Refund] Kết quả hoàn tiền từ VNPay cho đơn ${order.orderCode}:`, refundResult);

        if (refundResult?.vnp_ResponseCode === '00') {
            return { success: true, data: refundResult };
        } else {
            return { 
                success: false, 
                code: refundResult?.vnp_ResponseCode, 
                message: refundResult?.vnp_Message 
            };
        }
    } catch (error) {
        console.error(`[VNPAY Refund] Lỗi khi gọi API hoàn tiền cho đơn ${order.orderCode}:`, error);
        return { success: false, error: error.message };
    }
};

export { PaymentServiceError };
