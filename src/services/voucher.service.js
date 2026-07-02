// Tien - Dịch vụ xử lý logic cho Voucher (CRUD & tìm kiếm voucher khả dụng)
import Voucher from '../models/voucher.model.js';
import User from '../models/user.js';

class VoucherServiceError extends Error {
    constructor(statusCode, message, code = 'VOUCHER_ERROR') {
        super(message);
        this.name = 'VoucherServiceError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

const createServiceError = (statusCode, message, code) => {
    return new VoucherServiceError(statusCode, message, code);
};

// Tien - Tạo mới voucher (Admin)
export const createVoucher = async (payload) => {
    const code = String(payload.code || '').trim().toUpperCase();
    if (!code) {
        throw createServiceError(400, 'Mã voucher không được để trống', 'MISSING_CODE');
    }

    const existing = await Voucher.findOne({ code });
    if (existing) {
        throw createServiceError(400, 'Mã voucher đã tồn tại trên hệ thống', 'DUPLICATE_CODE');
    }

    const voucher = new Voucher({
        ...payload,
        code
    });

    return await voucher.save();
};

// Tien - Lấy danh sách voucher cho Admin (phân trang và tìm kiếm)
export const getVouchersAdmin = async ({ page = 1, limit = 10, search = '' }) => {
    const query = {};
    const cleanSearch = String(search || '').trim();
    if (cleanSearch) {
        query.code = { $regex: cleanSearch, $options: 'i' };
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Number(limit) || 10);
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
        Voucher.find(query).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
        Voucher.countDocuments(query)
    ]);

    return {
        items,
        pagination: {
            page: safePage,
            limit: safeLimit,
            total,
            totalPages: Math.ceil(total / safeLimit)
        }
    };
};

// Tien - Chi tiết voucher (Admin)
export const getVoucherById = async (id) => {
    const voucher = await Voucher.findById(id).lean();
    if (!voucher) {
        throw createServiceError(404, 'Không tìm thấy voucher', 'VOUCHER_NOT_FOUND');
    }
    return voucher;
};

// Tien - Cập nhật voucher (Admin)
export const updateVoucher = async (id, payload) => {
    if (payload.code) {
        payload.code = String(payload.code).trim().toUpperCase();
    }

    const voucher = await Voucher.findById(id);
    if (!voucher) {
        throw createServiceError(404, 'Không tìm thấy voucher', 'VOUCHER_NOT_FOUND');
    }

    if (payload.code && payload.code !== voucher.code) {
        const existing = await Voucher.findOne({ code: payload.code });
        if (existing) {
            throw createServiceError(400, 'Mã voucher mới trùng với mã đã có sẵn', 'DUPLICATE_CODE');
        }
    }

    Object.assign(voucher, payload);
    return await voucher.save();
};

// Tien - Xóa voucher (Admin)
export const deleteVoucher = async (id) => {
    const result = await Voucher.findByIdAndDelete(id);
    if (!result) {
        throw createServiceError(404, 'Không tìm thấy voucher để xóa', 'VOUCHER_NOT_FOUND');
    }
    return { success: true };
};

// Tien - Lấy tất cả voucher khả dụng cho User (mã chung & mã review cá nhân)
export const getAvailableVouchersForUser = async (userId) => {
    const now = new Date();

    // 1. Lấy voucher hệ thống (Admin tạo) đang hoạt động và chưa hết hạn
    const systemVouchers = await Voucher.find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now }
    }).lean();

    // 2. Lấy voucher cá nhân (Review coupons) từ User
    const user = await User.findById(userId).select('rewardCoupons').lean();
    const reviewCoupons = (user?.rewardCoupons || []).filter(coupon => {
        return !coupon.isUsed && new Date(coupon.expiresAt) > now;
    });

    return {
        systemVouchers,
        reviewCoupons
    };
};
