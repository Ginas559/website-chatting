import axios from 'axios';
import Order from '../models/order.model.js';
import User from '../models/user.js';

const RISK_LEVEL = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
};

const RISK_SOURCE = {
    AI_MODEL: 'AI_MODEL',
    FALLBACK_RULE: 'FALLBACK_RULE',
    FALLBACK_DEFAULT: 'FALLBACK_DEFAULT',
};

const AI_FEATURE_DEFAULT_DISTANCE_KM = 10;

const normalizeNumber = (value, fallback = 0) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
};

const tinhSoNgayTaiKhoan = (createdAt) => {
    const createdTime = new Date(createdAt).getTime();

    if (!Number.isFinite(createdTime)) {
        return 0;
    }

    return Math.max(0, Math.floor((Date.now() - createdTime) / (24 * 60 * 60 * 1000)));
};

const taoKetQuaRuiRo = ({ riskScore, riskReasons, riskSource, fraudProbability = 0 }) => {
    const diemRuiRo = Math.min(Math.max(Number(riskScore || 0), 0), 100);
    const riskLevel = diemRuiRo >= 70
        ? RISK_LEVEL.HIGH
        : diemRuiRo >= 40
            ? RISK_LEVEL.MEDIUM
            : RISK_LEVEL.LOW;

    return {
        riskScore: diemRuiRo,
        riskLevel,
        isSuspicious: riskLevel === RISK_LEVEL.HIGH,
        riskReasons,
        fraudProbability: Math.min(Math.max(Number(fraudProbability || 0), 0), 1),
        riskSource,
    };
};

const truNgay = (soNgay) => new Date(Date.now() - soNgay * 24 * 60 * 60 * 1000);

const layThongKeDonHangTruocDo = async (userId) => {
    const [thongKe] = await Order.aggregate([
        { $match: { user: userId } },
        {
            $group: {
                _id: '$user',
                totalTransactions: { $sum: 1 },
                avgAmount: { $avg: '$totalAmount' },
            },
        },
    ]);

    return {
        totalTransactions: Number(thongKe?.totalTransactions || 0),
        avgAmount: Number(thongKe?.avgAmount || 0),
    };
};

export const tinhFeatureChoAi = async ({ userId, orderAmount, shippingDistanceKm }) => {
    const user = await User.findById(userId).select('createdAt').lean();

    if (!user) {
        throw new Error('Không tìm thấy thông tin người dùng để tạo feature AI');
    }

    const thongKeDonHang = await layThongKeDonHangTruocDo(user._id);
    const khoangCachGiaoHang = shippingDistanceKm === undefined || shippingDistanceKm === null || shippingDistanceKm === ''
        ? AI_FEATURE_DEFAULT_DISTANCE_KM
        : normalizeNumber(shippingDistanceKm, AI_FEATURE_DEFAULT_DISTANCE_KM);

    // He thong chua tinh khoang cach giao hang thuc te, tam dung gia tri mac dinh de dam bao dung schema model.
    return {
        account_age_days: tinhSoNgayTaiKhoan(user.createdAt),
        total_transactions_user: thongKeDonHang.totalTransactions,
        avg_amount_user: thongKeDonHang.avgAmount,
        amount: normalizeNumber(orderAmount, 0),
        shipping_distance_km: khoangCachGiaoHang,
    };
};

export const goiAiRiskService = async (features) => {
    const baseUrl = process.env.AI_RISK_SERVICE_URL || 'http://localhost:8000';
    const timeout = normalizeNumber(process.env.AI_RISK_TIMEOUT_MS, 5000);
    const url = `${baseUrl.replace(/\/$/, '')}/predict-risk`;

    const response = await axios.post(url, features, { timeout });
    const data = response?.data;

    if (!data?.success) {
        throw new Error(data?.message || data?.detail || 'AI risk service response khong hop le');
    }

    return data;
};

const layGiaTriTrungBinhDonHoanThanh = async (userId) => {
    const [ketQua] = await Order.aggregate([
        {
            $match: {
                user: userId,
                status: 'DELIVERED',
            },
        },
        {
            $group: {
                _id: '$user',
                averageAmount: { $avg: '$totalAmount' },
                totalOrders: { $sum: 1 },
            },
        },
    ]);

    return {
        averageAmount: Number(ketQua?.averageAmount || 0),
        totalOrders: Number(ketQua?.totalOrders || 0),
    };
};

export const tinhRuiRoBangRuleFallback = async ({ userId, orderAmount }) => {
    const user = await User.findById(userId).select('createdAt').lean();

    if (!user) {
        return taoKetQuaRuiRo({
            riskScore: 100,
            riskReasons: ['Không tìm thấy thông tin người dùng'],
            riskSource: RISK_SOURCE.FALLBACK_RULE,
            fraudProbability: 1,
        });
    }

    let riskScore = 0;
    const riskReasons = [];

    // TODO_AI_REPLACE_START
    // Phan rule-based tam thoi, sau nay se thay bang goi Python AI service
    const baNgayTruoc = truNgay(3);
    const motNgayTruoc = truNgay(1);
    const bayNgayTruoc = truNgay(7);

    if (new Date(user.createdAt).getTime() > baNgayTruoc.getTime()) {
        riskScore += 20;
        riskReasons.push('Tài khoản mới tạo dưới 3 ngày');
    }

    const soDonTrongNgay = await Order.countDocuments({
        user: user._id,
        createdAt: { $gte: motNgayTruoc },
    });

    if (soDonTrongNgay + 1 >= 3) {
        riskScore += 25;
        riskReasons.push('Người dùng đặt nhiều đơn trong 24 giờ gần nhất');
    }

    const soDonHuyTrongTuan = await Order.countDocuments({
        user: user._id,
        status: 'CANCELLED',
        updatedAt: { $gte: bayNgayTruoc },
    });

    if (soDonHuyTrongTuan >= 2) {
        riskScore += 25;
        riskReasons.push('Người dùng có nhiều đơn bị hủy trong 7 ngày gần nhất');
    }

    const soDonGiaoThatBai = await Order.countDocuments({
        user: user._id,
        status: 'DELIVERY_FAILED',
    });

    if (soDonGiaoThatBai >= 2) {
        riskScore += 20;
        riskReasons.push('Người dùng có nhiều đơn giao thất bại');
    }

    const lichSuHoanThanh = await layGiaTriTrungBinhDonHoanThanh(user._id);
    const giaTriDonHienTai = Number(orderAmount || 0);

    if (
        lichSuHoanThanh.totalOrders > 0
        && lichSuHoanThanh.averageAmount > 0
        && giaTriDonHienTai > lichSuHoanThanh.averageAmount * 3
    ) {
        riskScore += 20;
        riskReasons.push('Giá trị đơn hàng cao bất thường so với lịch sử mua hàng');
    }
    // TODO_AI_REPLACE_END

    return taoKetQuaRuiRo({
        riskScore,
        riskReasons,
        riskSource: RISK_SOURCE.FALLBACK_RULE,
        fraudProbability: riskScore / 100,
    });
};

const taoKetQuaMacDinh = () => ({
    riskScore: 0,
    riskLevel: RISK_LEVEL.LOW,
    riskReasons: [],
    isSuspicious: false,
    fraudProbability: 0,
    riskSource: RISK_SOURCE.FALLBACK_DEFAULT,
});

export const layKetQuaRuiRoAnToan = async ({ userId, orderAmount, shippingDistanceKm }) => {
    const engineMode = String(process.env.RISK_ENGINE_MODE || 'AI_FIRST').toUpperCase();

    if (engineMode === 'AI_FIRST') {
        try {
            const features = await tinhFeatureChoAi({ userId, orderAmount, shippingDistanceKm });
            const aiResult = await goiAiRiskService(features);

            console.log('[Risk] AI_MODEL result:', {
                riskScore: aiResult.riskScore,
                riskLevel: aiResult.riskLevel,
                fraudProbability: aiResult.fraudProbability,
            });

            return {
                riskScore: normalizeNumber(aiResult.riskScore, 0),
                riskLevel: aiResult.riskLevel || RISK_LEVEL.LOW,
                riskReasons: Array.isArray(aiResult.riskReasons) ? aiResult.riskReasons : [],
                isSuspicious: Boolean(aiResult.isSuspicious),
                fraudProbability: normalizeNumber(aiResult.fraudProbability, 0),
                riskSource: RISK_SOURCE.AI_MODEL,
            };
        } catch (error) {
            console.error('AI risk service error:', error?.message || error);
        }
    }

    try {
        const fallbackResult = await tinhRuiRoBangRuleFallback({ userId, orderAmount });
        console.log('[Risk] FALLBACK_RULE result:', {
            riskScore: fallbackResult.riskScore,
            riskLevel: fallbackResult.riskLevel,
        });
        return fallbackResult;
    } catch (error) {
        console.error('Fallback risk service error:', error?.message || error);
        return taoKetQuaMacDinh();
    }
};

export const tinhMucDoRuiRoDonHang = tinhRuiRoBangRuleFallback;
