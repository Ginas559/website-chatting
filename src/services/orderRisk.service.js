import Order from '../models/order.model.js';
import User from '../models/user.js';

const RISK_LEVEL = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
};

const taoKetQuaRuiRo = ({ riskScore, riskReasons }) => {
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
    };
};

const truNgay = (soNgay) => new Date(Date.now() - soNgay * 24 * 60 * 60 * 1000);

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

export const tinhMucDoRuiRoDonHang = async ({ userId, orderAmount }) => {
    const user = await User.findById(userId).select('createdAt').lean();

    if (!user) {
        return {
            riskScore: 100,
            riskLevel: RISK_LEVEL.HIGH,
            isSuspicious: true,
            riskReasons: ['Không tìm thấy thông tin người dùng'],
        };
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
        status: 'CANCELLED',
        'statusHistory.status': 'SHIPPING',
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

    return taoKetQuaRuiRo({ riskScore, riskReasons });
};

export const layKetQuaRuiRoAnToan = async ({ userId, orderAmount }) => {
    try {
        return await tinhMucDoRuiRoDonHang({ userId, orderAmount });
    } catch (error) {
        console.error('Loi tinh muc do rui ro don hang:', error);
        return {
            riskScore: 0,
            riskLevel: RISK_LEVEL.LOW,
            riskReasons: [],
            isSuspicious: false,
        };
    }
};
