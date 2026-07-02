import mongoose from 'mongoose';
import Cart from '../models/cart.model.js';
import Product from '../models/product.model.js';
import User from '../models/user.js';
import Voucher from '../models/voucher.model.js';

// Tien - Hoàn trả điểm tích lũy và voucher khi đơn hàng bị hủy
export const refundOrderDiscounts = async ({ order, userId, session }) => {
    if (order.pointsUsed && order.pointsUsed > 0) {
        await User.updateOne(
            { _id: userId },
            { $inc: { rewardPoints: order.pointsUsed } },
            { session }
        );
    }

    if (order.couponCode) {
        const cleanCouponCode = String(order.couponCode).trim().toUpperCase();
        const user = await User.findById(userId).session(session);
        if (user && Array.isArray(user.rewardCoupons)) {
            const userCoupon = user.rewardCoupons.find(c => c.code === cleanCouponCode);
            if (userCoupon) {
                await User.updateOne(
                    { _id: userId, 'rewardCoupons.code': cleanCouponCode },
                    {
                        $set: { 'rewardCoupons.$.isUsed': false },
                        $unset: { 'rewardCoupons.$.usedAt': '' }
                    },
                    { session }
                );
                return;
            }
        }

        const systemVoucher = await Voucher.findOne({ code: cleanCouponCode }).session(session);
        if (systemVoucher) {
            systemVoucher.usedCount = Math.max(0, systemVoucher.usedCount - 1);
            await systemVoucher.save({ session });
        }
    }
};

export const SHIPPING_FEE = 0;

const PHONE_PATTERN = /^[0-9+\-\s()]{8,20}$/;
const VIETNAM_PROVINCES = [
    'An Giang',
    'Bắc Ninh',
    'Cà Mau',
    'Cao Bằng',
    'Cần Thơ',
    'Đà Nẵng',
    'Đắk Lắk',
    'Điện Biên',
    'Đồng Nai',
    'Đồng Tháp',
    'Gia Lai',
    'Hà Nội',
    'Hà Tĩnh',
    'Hải Phòng',
    'Hồ Chí Minh',
    'Huế',
    'Hưng Yên',
    'Khánh Hòa',
    'Lai Châu',
    'Lâm Đồng',
    'Lạng Sơn',
    'Lào Cai',
    'Nghệ An',
    'Ninh Bình',
    'Phú Thọ',
    'Quảng Ngãi',
    'Quảng Ninh',
    'Quảng Trị',
    'Sơn La',
    'Tây Ninh',
    'Thái Nguyên',
    'Thanh Hóa',
    'Tuyên Quang',
    'Vĩnh Long',
];
const VIETNAM_PROVINCE_SET = new Set(VIETNAM_PROVINCES);

export const normalizeText = (value) => String(value || '').trim();

export const ensureObjectId = (value, fieldName, createServiceError) => {
    if (!mongoose.isValidObjectId(value)) {
        throw createServiceError(400, `${fieldName} không hợp lệ`, 'INVALID_OBJECT_ID');
    }
};

export const normalizeShippingInfo = (payload = {}, createServiceError) => {
    const fullName = normalizeText(payload.fullName);
    const phone = normalizeText(payload.phone);
    const address = normalizeText(payload.address);
    const city = normalizeText(payload.city);
    const note = normalizeText(payload.note);

    if (fullName.length < 2 || fullName.length > 80) {
        throw createServiceError(400, 'Họ tên người nhận phải từ 2 đến 80 ký tự', 'INVALID_FULL_NAME');
    }

    if (!PHONE_PATTERN.test(phone)) {
        throw createServiceError(400, 'Số điện thoại người nhận không hợp lệ', 'INVALID_PHONE');
    }

    if (address.length < 8 || address.length > 240) {
        throw createServiceError(400, 'Địa chỉ nhận hàng phải từ 8 đến 240 ký tự', 'INVALID_ADDRESS');
    }

    if (!VIETNAM_PROVINCE_SET.has(city)) {
        throw createServiceError(400, 'Tỉnh/thành phố không hợp lệ', 'INVALID_CITY', {
            validCities: VIETNAM_PROVINCES,
        });
    }

    if (note.length > 300) {
        throw createServiceError(400, 'Ghi chú không được vượt quá 300 ký tự', 'INVALID_NOTE');
    }

    return { fullName, phone, address, city, note };
};

const getCartItemProductId = (item) => {
    return String(item?.product?._id || item?.product || '');
};

const assertValidCartItemQuantity = (quantity, product, createServiceError) => {
    if (!Number.isInteger(quantity) || quantity < 1) {
        throw createServiceError(400, `Số lượng của sản phẩm ${product?.name || ''} không hợp lệ`, 'INVALID_ITEM_QUANTITY');
    }
};

const assertProductCanCheckout = (cartItem, product, createServiceError) => {
    const quantity = Number(cartItem.quantity || 0);

    if (!product) {
        throw createServiceError(400, 'Một sản phẩm trong giỏ hàng không còn tồn tại', 'PRODUCT_NOT_FOUND');
    }

    assertValidCartItemQuantity(quantity, product, createServiceError);

    if (product.isActive === false) {
        throw createServiceError(400, `Sản phẩm ${product.name} đã ngừng bán`, 'PRODUCT_INACTIVE');
    }

    if (Number(product.stock || 0) < quantity) {
        throw createServiceError(400, `Sản phẩm ${product.name} không đủ tồn kho`, 'INSUFFICIENT_STOCK', {
            productId: product._id,
            stock: Number(product.stock || 0),
            requestedQuantity: quantity,
        });
    }

    const cartPrice = Number(cartItem.snapshot?.price);
    const currentPrice = Number(product.price || 0);
    if (!Number.isFinite(cartPrice) || cartPrice !== currentPrice) {
        throw createServiceError(409, `Giá sản phẩm ${product.name} đã thay đổi, vui lòng kiểm tra lại giỏ hàng`, 'PRICE_CHANGED', {
            productId: product._id,
            cartPrice,
            currentPrice,
        });
    }
};

const mapOrderItem = (cartItem, product) => {
    const quantity = Number(cartItem.quantity || 0);
    const unitPrice = Number(product.price || 0);

    return {
        product: product._id,
        quantity,
        unitPrice,
        lineTotal: quantity * unitPrice,
        snapshot: {
            name: cartItem.snapshot?.name || product.name,
            slug: product.slug,
            image: cartItem.snapshot?.image || product.image || (Array.isArray(product.images) ? product.images[0] : ''),
            price: unitPrice,
            brand: cartItem.snapshot?.brand || product.brand,
            category: product.category,
        },
    };
};

const getProductsByCartItems = async (items, session) => {
    const productIds = items.map((item) => item.product);
    const products = await Product.find({ _id: { $in: productIds } }).session(session).lean();
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    return items.map((item) => ({
        cartItem: item,
        product: productMap.get(getCartItemProductId(item)),
    }));
};

const normalizeSelectedProductIds = (selectedProductIds, createServiceError) => {
    if (selectedProductIds === undefined || selectedProductIds === null) {
        return null;
    }

    if (!Array.isArray(selectedProductIds)) {
        throw createServiceError(400, 'Danh sách sản phẩm thanh toán không hợp lệ', 'INVALID_SELECTED_PRODUCTS');
    }

    const normalizedIds = selectedProductIds.map((productId) => normalizeText(productId)).filter(Boolean);
    if (!normalizedIds.length) {
        throw createServiceError(400, 'Vui lòng chọn ít nhất một sản phẩm để thanh toán', 'EMPTY_SELECTED_PRODUCTS');
    }

    normalizedIds.forEach((productId) => ensureObjectId(productId, 'Sản phẩm thanh toán', createServiceError));

    return new Set(normalizedIds);
};

export const buildOrderDraftFromCart = async ({
    userId,
    shippingInfo,
    selectedProductIds,
    itemIds,
    session,
    createServiceError,
}) => {
    ensureObjectId(userId, 'Người dùng', createServiceError);

    const normalizedShippingInfo = normalizeShippingInfo(shippingInfo, createServiceError);
    const selectedProductIdSet = normalizeSelectedProductIds(selectedProductIds ?? itemIds, createServiceError);
    const cart = await Cart.findOne({ user: userId }).session(session);

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
        throw createServiceError(400, 'Giỏ hàng đang trống, không thể thanh toán', 'EMPTY_CART');
    }

    const checkoutItems = selectedProductIdSet
        ? cart.items.filter((item) => selectedProductIdSet.has(getCartItemProductId(item)))
        : cart.items;

    if (!checkoutItems.length) {
        throw createServiceError(400, 'Các sản phẩm đã chọn không còn trong giỏ hàng', 'SELECTED_PRODUCTS_NOT_IN_CART');
    }

    if (selectedProductIdSet && checkoutItems.length !== selectedProductIdSet.size) {
        throw createServiceError(400, 'Một số sản phẩm đã chọn không còn trong giỏ hàng', 'SELECTED_PRODUCTS_NOT_IN_CART');
    }

    const entries = await getProductsByCartItems(checkoutItems, session);
    entries.forEach(({ cartItem, product }) => assertProductCanCheckout(cartItem, product, createServiceError));

    const orderItems = entries.map(({ cartItem, product }) => mapOrderItem(cartItem, product));
    const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);

    if (subtotal <= 0) {
        throw createServiceError(400, 'Tổng tiền đơn hàng không hợp lệ', 'INVALID_ORDER_TOTAL');
    }

    return {
        cart,
        orderItems,
        shippingInfo: normalizedShippingInfo,
        subtotal,
        shippingFee: SHIPPING_FEE,
        totalAmount: subtotal + SHIPPING_FEE,
    };
};

export const applyStockForOrderItems = async (orderItems, session, createServiceError) => {
    const stockUpdates = orderItems.map((item) => ({
        updateOne: {
            filter: {
                _id: item.product,
                isActive: true,
                stock: { $gte: item.quantity },
                price: item.unitPrice,
            },
            update: {
                $inc: {
                    stock: -item.quantity,
                    soldCount: item.quantity,
                },
            },
        },
    }));

    const updateResult = await Product.bulkWrite(stockUpdates, { session, ordered: true });
    if (updateResult.modifiedCount !== orderItems.length) {
        throw createServiceError(409, 'Sản phẩm vừa thay đổi giá hoặc tồn kho, vui lòng kiểm tra lại giỏ hàng', 'PRODUCT_CHANGED');
    }
};

export const clearCart = async (cart, session) => {
    cart.items = [];
    await cart.save({ session });
};

export const clearOrderedItemsFromCart = async (userId, orderItems, session) => {
    const orderedProductIds = orderItems.map((item) => item.product);

    await Cart.updateOne(
        { user: userId },
        {
            $pull: {
                items: {
                    product: { $in: orderedProductIds },
                },
            },
        },
        { session }
    );
};

export const mapOrder = (order) => {
    if (!order) return null;

    return {
        id: order._id,
        orderCode: order.orderCode,
        userId: order.user,
        items: order.items,
        shippingInfo: order.shippingInfo,
        subtotal: order.subtotal,
        shippingFee: order.shippingFee,
        discountAmount: order.discountAmount || 0,
        couponCode: order.couponCode || '',
        couponDiscount: order.couponDiscount || 0,
        pointsUsed: order.pointsUsed || 0,
        pointsDiscount: order.pointsDiscount || 0,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        paymentInfo: order.paymentInfo,
        status: order.status,
        statusHistory: order.statusHistory,
        riskScore: Number(order.riskScore || 0),
        riskLevel: order.riskLevel || 'LOW',
        riskReasons: Array.isArray(order.riskReasons) ? order.riskReasons : [],
        isSuspicious: Boolean(order.isSuspicious),
        fraudProbability: Number(order.fraudProbability || 0),
        riskSource: order.riskSource || 'FALLBACK_DEFAULT',
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
    };
};