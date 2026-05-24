import {
    addToCart,
    clearCart,
    getCurrentCart,
    removeFromCart,
    updateCartItemQuantity,
    CartServiceError,
} from '../services/cart.service.js';

const sendSuccessResponse = (res, { message, data, pagination, status = 200 }) => {
    return res.status(status).json({
        success: true,
        errCode: 0,
        errMessage: message,
        data,
        ...(pagination ? { pagination } : {}),
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

export const getCurrentCartController = async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        const cart = await getCurrentCart({
            userId,
            page: req.query?.page,
            limit: req.query?.limit,
        });

        return sendSuccessResponse(res, {
            message: 'Lấy giỏ hàng thành công',
            data: cart,
            pagination: cart.pagination || undefined,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof CartServiceError ? error.statusCode : 500,
            message: error instanceof CartServiceError ? error.message : 'Lỗi server khi lấy giỏ hàng',
            error,
        });
    }
};

export const addToCartController = async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        const cart = await addToCart({
            userId,
            productId: req.body?.productId,
            quantity: req.body?.quantity,
        });

        return sendSuccessResponse(res, {
            message: 'Thêm sản phẩm vào giỏ hàng thành công',
            data: cart,
            pagination: cart.pagination || undefined,
            status: 201,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof CartServiceError ? error.statusCode : 500,
            message: error instanceof CartServiceError ? error.message : 'Lỗi server khi thêm sản phẩm vào giỏ hàng',
            error,
        });
    }
};

export const removeFromCartController = async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        const cart = await removeFromCart({
            userId,
            productId: req.params?.productId,
        });

        return sendSuccessResponse(res, {
            message: 'Xóa sản phẩm khỏi giỏ hàng thành công',
            data: cart,
            pagination: cart.pagination || undefined,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof CartServiceError ? error.statusCode : 500,
            message: error instanceof CartServiceError ? error.message : 'Lỗi server khi xóa sản phẩm khỏi giỏ hàng',
            error,
        });
    }
};

export const updateCartItemQuantityController = async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        const cart = await updateCartItemQuantity({
            userId,
            productId: req.params?.productId,
            quantity: req.body?.quantity,
        });

        return sendSuccessResponse(res, {
            message: 'Cập nhật số lượng sản phẩm thành công',
            data: cart,
            pagination: cart.pagination || undefined,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof CartServiceError ? error.statusCode : 500,
            message: error instanceof CartServiceError ? error.message : 'Lỗi server khi cập nhật số lượng sản phẩm',
            error,
        });
    }
};

export const clearCartController = async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        const cart = await clearCart({ userId });

        return sendSuccessResponse(res, {
            message: 'Xóa toàn bộ giỏ hàng thành công',
            data: cart,
            pagination: cart.pagination || undefined,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error instanceof CartServiceError ? error.statusCode : 500,
            message: error instanceof CartServiceError ? error.message : 'Lỗi server khi xóa giỏ hàng',
            error,
        });
    }
};