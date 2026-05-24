import mongoose from 'mongoose';
import Cart from '../models/cart.model.js';
import Product from '../models/product.model.js';

const PRODUCT_SELECT_FIELDS = 'name slug brand category image images price stock isActive';
const LIVE_PRODUCT_SELECT_FIELDS = 'stock isActive';
const DEFAULT_CART_PAGE_SIZE = 12;
const MAX_CART_PAGE_SIZE = 50;

class CartServiceError extends Error {
    constructor(statusCode, message, code = 'CART_ERROR', details = null) {
        super(message);
        this.name = 'CartServiceError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isCartServiceError = true;
    }
}

const createServiceError = (statusCode, message, code = 'CART_ERROR', details = null) => {
    return new CartServiceError(statusCode, message, code, details);
};

const toPositiveInteger = (value, fallback) => {
    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue)) {
        return fallback;
    }

    return Math.trunc(parsedValue);
};

const parsePagination = ({ page, limit }) => {
    const safePage = Math.max(toPositiveInteger(page, 1), 1);
    const rawLimit = toPositiveInteger(limit, DEFAULT_CART_PAGE_SIZE);
    const safeLimit = Math.min(Math.max(rawLimit, 1), MAX_CART_PAGE_SIZE);

    return {
        page: safePage,
        limit: safeLimit,
        skip: (safePage - 1) * safeLimit,
    };
};

const parseQuantity = (value) => {
    const quantity = Number(value);

    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 1) {
        throw createServiceError(400, 'Số lượng sản phẩm phải là số nguyên lớn hơn 0', 'INVALID_QUANTITY');
    }

    return quantity;
};

const ensureObjectId = (value, fieldName) => {
    if (!mongoose.isValidObjectId(value)) {
        throw createServiceError(400, `${fieldName} không hợp lệ`, 'INVALID_OBJECT_ID');
    }
};

const normalizeSnapshot = (product) => ({
    name: product.name,
    image: product.image || (Array.isArray(product.images) && product.images[0]) || '',
    price: Number(product.price) || 0,
    brand: product.brand,
});

const getItemSnapshot = (item) => {
    if (item?.snapshot) {
        return item.snapshot;
    }

    const product = item?.product;

    if (!product) {
        return null;
    }

    return normalizeSnapshot(product);
};

const getCartItemProductId = (item) => {
    if (!item || !item.product) {
        return null;
    }

    return String(item.product._id || item.product);
};

const mapCartItem = (item) => {
    if (!item) {
        return null;
    }

    const snapshot = getItemSnapshot(item);
    const product = item.product || null;
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(snapshot?.price) || 0;
    const availableStock = product && product.isActive !== false ? Math.max(Number(product.stock) || 0, 0) : null;
    const remainingToIncrease = availableStock === null ? null : Math.max(availableStock - quantity, 0);
    const canIncrease = remainingToIncrease === null ? false : remainingToIncrease > 0;

    return {
        cartItemId: item._id,
        productId: product?._id || item.product || null,
        id: item._id,
        qty: quantity,
        quantity,
        unitPrice,
        lineTotal: quantity * unitPrice,
        snapshot,
        product: snapshot
            ? {
                  id: product?._id || item.product || null,
                  name: snapshot.name,
                  brand: snapshot.brand,
                  image: snapshot.image,
                  price: snapshot.price,
                  stock: availableStock,
                  isActive: product ? product.isActive !== false : false,
              }
            : null,
        availability: {
            inStock: availableStock === null ? false : availableStock > 0,
            stock: availableStock,
            remainingToIncrease,
            canIncrease,
        },
    };
};

const buildCartSnapshot = (cartDoc, paginationInput) => {
    const rawItems = Array.isArray(cartDoc?.items) ? cartDoc.items : [];
    const items = rawItems.map(mapCartItem).filter(Boolean);
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const pagination = paginationInput
        ? (() => {
              const start = paginationInput.skip;
              const paginatedItems = items.slice(start, start + paginationInput.limit);

              return {
                  page: paginationInput.page,
                  limit: paginationInput.limit,
                  total: items.length,
                  totalPages: items.length > 0 ? Math.ceil(items.length / paginationInput.limit) : 1,
                  hasMore: start + paginatedItems.length < items.length,
              };
          })()
        : null;

    return {
        cartId: cartDoc?._id || null,
        userId: cartDoc?.user || null,
        items: pagination ? items.slice(paginationInput.skip, paginationInput.skip + paginationInput.limit) : items,
        totalItems: items.length,
        totalQuantity,
        subtotal,
        pagination,
    };
};

const fetchCartDocument = async (userId) => {
    return Cart.findOne({ user: userId })
        .populate({
            path: 'items.product',
            select: LIVE_PRODUCT_SELECT_FIELDS,
        })
        .lean();
};

const ensureProductIsSellable = (product, requestedQuantity) => {
    if (!product) {
        throw createServiceError(404, 'Không tìm thấy sản phẩm', 'PRODUCT_NOT_FOUND');
    }

    if (product.isActive === false) {
        throw createServiceError(400, 'Sản phẩm hiện không khả dụng', 'PRODUCT_INACTIVE');
    }

    if (Number(product.stock) < requestedQuantity) {
        throw createServiceError(400, 'Số lượng vượt quá tồn kho hiện tại', 'INSUFFICIENT_STOCK', {
            stock: Number(product.stock) || 0,
            requestedQuantity,
        });
    }
};

const getProductAndCart = async ({ userId, productId }) => {
    const [product, cart] = await Promise.all([
        Product.findById(productId).select(PRODUCT_SELECT_FIELDS).lean(),
        Cart.findOne({ user: userId }),
    ]);

    return { product, cart };
};

const saveCart = async (cart) => {
    await cart.save();

    const savedCart = await fetchCartDocument(cart.user);

    return buildCartSnapshot(savedCart, null);
};

export const getCurrentCart = async ({ userId, page, limit } = {}) => {
    ensureObjectId(userId, 'Người dùng');

    const paginationInput = parsePagination({ page, limit });
    const cart = await fetchCartDocument(userId);

    return buildCartSnapshot(cart, paginationInput);
};

export const addToCart = async ({ userId, productId, quantity = 1 }) => {
    ensureObjectId(userId, 'Người dùng');
    ensureObjectId(productId, 'Sản phẩm');

    const requestedQuantity = parseQuantity(quantity);
    const { product, cart } = await getProductAndCart({ userId, productId });

    ensureProductIsSellable(product, requestedQuantity);

    const productKey = String(product._id);
    const cartDoc = cart || new Cart({ user: userId, items: [] });
    const existingItem = cartDoc.items.find((item) => getCartItemProductId(item) === productKey);

    if (existingItem) {
        const mergedQuantity = Number(existingItem.quantity || 0) + requestedQuantity;

        if (mergedQuantity > Number(product.stock)) {
            throw createServiceError(400, 'Số lượng trong giỏ hàng vượt quá tồn kho hiện tại', 'INSUFFICIENT_STOCK', {
                stock: Number(product.stock) || 0,
                requestedQuantity: mergedQuantity,
            });
        }

        existingItem.quantity = mergedQuantity;
        existingItem.snapshot = existingItem.snapshot || normalizeSnapshot(product);
    } else {
        cartDoc.items.push({
            product: product._id,
            quantity: requestedQuantity,
            snapshot: normalizeSnapshot(product),
        });
    }

    return saveCart(cartDoc);
};

export const removeFromCart = async ({ userId, productId }) => {
    ensureObjectId(userId, 'Người dùng');
    ensureObjectId(productId, 'Sản phẩm');

    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
        throw createServiceError(404, 'Giỏ hàng chưa tồn tại', 'CART_NOT_FOUND');
    }

    const beforeLength = cart.items.length;
    cart.items = cart.items.filter((item) => getCartItemProductId(item) !== String(productId));

    if (cart.items.length === beforeLength) {
        throw createServiceError(404, 'Sản phẩm không tồn tại trong giỏ hàng', 'CART_ITEM_NOT_FOUND');
    }

    return saveCart(cart);
};

export const updateCartItemQuantity = async ({ userId, productId, quantity }) => {
    ensureObjectId(userId, 'Người dùng');
    ensureObjectId(productId, 'Sản phẩm');

    const requestedQuantity = parseQuantity(quantity);
    const { product, cart } = await getProductAndCart({ userId, productId });

    ensureProductIsSellable(product, requestedQuantity);

    if (!cart) {
        throw createServiceError(404, 'Giỏ hàng chưa tồn tại', 'CART_NOT_FOUND');
    }

    const existingItem = cart.items.find((item) => getCartItemProductId(item) === String(productId));

    if (!existingItem) {
        throw createServiceError(404, 'Sản phẩm không tồn tại trong giỏ hàng', 'CART_ITEM_NOT_FOUND');
    }

    existingItem.quantity = requestedQuantity;
    existingItem.snapshot = existingItem.snapshot || normalizeSnapshot(product);

    return saveCart(cart);
};

export const clearCart = async ({ userId }) => {
    ensureObjectId(userId, 'Người dùng');

    const cart = (await Cart.findOne({ user: userId })) || new Cart({ user: userId, items: [] });
    cart.items = [];

    return saveCart(cart);
};

export { CartServiceError };