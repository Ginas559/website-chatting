import mongoose from 'mongoose';
import Cart from '../models/cart.model.js';
import Product from '../models/product.model.js';

export const SHIPPING_FEE = 0;

const PHONE_PATTERN = /^[0-9+\-\s()]{8,20}$/;

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

    if (city.length > 80) {
        throw createServiceError(400, 'Tỉnh/thành phố không được vượt quá 80 ký tự', 'INVALID_CITY');
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
            color: cartItem.snapshot?.color || '',
            capacity: cartItem.snapshot?.capacity || '',
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

export const buildOrderDraftFromCart = async ({ userId, shippingInfo, session, createServiceError, productIds, directItem }) => {
    ensureObjectId(userId, 'Người dùng', createServiceError);
    const normalizedShippingInfo = normalizeShippingInfo(shippingInfo, createServiceError);

    let itemsToProcess = [];
    let cart = null;

    if (directItem) {
        const product = await Product.findById(directItem.productId).session(session).lean();
        if (!product) {
            throw createServiceError(400, 'Sản phẩm không tồn tại', 'PRODUCT_NOT_FOUND');
        }
        itemsToProcess = [{
            product: directItem.productId,
            quantity: Number(directItem.quantity || 1),
            qty: Number(directItem.quantity || 1),
            snapshot: {
                name: product.name,
                image: product.image,
                price: product.price,
                brand: product.brand,
                color: directItem.color || '',
                capacity: directItem.capacity || ''
            }
        }];
    } else {
        cart = await Cart.findOne({ user: userId }).session(session);

        if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
            throw createServiceError(400, 'Giỏ hàng đang trống, không thể thanh toán', 'EMPTY_CART');
        }

        itemsToProcess = cart.items;
        if (Array.isArray(productIds) && productIds.length > 0) {
            const productIdsStr = productIds.map(String);
            itemsToProcess = cart.items.filter((item) => productIdsStr.includes(String(item.product)));
        }
    }

    if (itemsToProcess.length === 0) {
        throw createServiceError(400, 'Không có sản phẩm nào được chọn để thanh toán', 'EMPTY_CHECKOUT');
    }

    const entries = await getProductsByCartItems(itemsToProcess, session);
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
