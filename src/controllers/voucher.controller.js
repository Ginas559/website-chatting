// Tien - Controller điều phối các request liên quan đến Voucher
import * as voucherService from '../services/voucher.service.js';

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
        error: error?.message || null,
    });
};

const getUserIdFromRequest = (req) => {
    return req.user?.id || req.user?._id || null;
};

// Tien - API tạo voucher (Admin)
export const createVoucherController = async (req, res) => {
    try {
        const voucher = await voucherService.createVoucher(req.body);
        return sendSuccessResponse(res, {
            message: 'Tạo mã giảm giá thành công',
            data: voucher,
            status: 201,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error.statusCode || 500,
            message: error.message || 'Lỗi server khi tạo voucher',
            error,
        });
    }
};

// Tien - API lấy danh sách voucher (Admin)
export const getVouchersAdminController = async (req, res) => {
    try {
        const result = await voucherService.getVouchersAdmin({
            page: req.query?.page,
            limit: req.query?.limit,
            search: req.query?.search,
        });
        return sendSuccessResponse(res, {
            message: 'Lấy danh sách mã giảm giá thành công',
            data: result,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error.statusCode || 500,
            message: error.message || 'Lỗi server khi lấy danh sách voucher',
            error,
        });
    }
};

// Tien - API lấy chi tiết voucher (Admin)
export const getVoucherByIdController = async (req, res) => {
    try {
        const voucher = await voucherService.getVoucherById(req.params.id);
        return sendSuccessResponse(res, {
            message: 'Lấy chi tiết mã giảm giá thành công',
            data: voucher,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error.statusCode || 500,
            message: error.message || 'Lỗi server khi lấy chi tiết voucher',
            error,
        });
    }
};

// Tien - API cập nhật voucher (Admin)
export const updateVoucherController = async (req, res) => {
    try {
        const voucher = await voucherService.updateVoucher(req.params.id, req.body);
        return sendSuccessResponse(res, {
            message: 'Cập nhật mã giảm giá thành công',
            data: voucher,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error.statusCode || 500,
            message: error.message || 'Lỗi server khi cập nhật voucher',
            error,
        });
    }
};

// Tien - API xóa voucher (Admin)
export const deleteVoucherController = async (req, res) => {
    try {
        await voucherService.deleteVoucher(req.params.id);
        return sendSuccessResponse(res, {
            message: 'Xóa mã giảm giá thành công',
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error.statusCode || 500,
            message: error.message || 'Lỗi server khi xóa voucher',
            error,
        });
    }
};

// Tien - API lấy mã giảm giá khả dụng cho khách hàng
export const getAvailableVouchersController = async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        const result = await voucherService.getAvailableVouchersForUser(userId);
        return sendSuccessResponse(res, {
            message: 'Lấy danh sách mã giảm giá khả dụng thành công',
            data: result,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: error.statusCode || 500,
            message: error.message || 'Lỗi server khi lấy voucher khả dụng',
            error,
        });
    }
};
