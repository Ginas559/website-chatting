import mongoose from 'mongoose';
import Order from '../models/order.model.js';
import Review from '../models/review.model.js';
import User from '../models/user.js';

class LoyaltyServiceError extends Error {
    constructor(statusCode, message, code = 'LOYALTY_ERROR') {
        super(message);
        this.name = 'LoyaltyServiceError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

const createServiceError = (statusCode, message, code) => new LoyaltyServiceError(statusCode, message, code);

const LEVELS = [
    { key: 'BRONZE', name: 'Bronze', minPoints: 0 },
    { key: 'SILVER', name: 'Silver', minPoints: 100 },
    { key: 'GOLD', name: 'Gold', minPoints: 300 },
    { key: 'DIAMOND', name: 'Diamond', minPoints: 700 },
];

const getMembership = (points) => {
    const safePoints = Math.max(0, Number(points || 0));
    const currentIndex = LEVELS.reduce((matchedIndex, level, index) => (
        safePoints >= level.minPoints ? index : matchedIndex
    ), 0);
    const current = LEVELS[currentIndex];
    const next = LEVELS[currentIndex + 1] || null;
    const progressPercent = next
        ? Math.min(100, Math.round(((safePoints - current.minPoints) / (next.minPoints - current.minPoints)) * 100))
        : 100;

    return {
        current,
        next,
        progressPercent,
        pointsToNext: next ? Math.max(0, next.minPoints - safePoints) : 0,
    };
};

const mapCoupon = (coupon) => {
    const expiresAt = coupon.expiresAt ? new Date(coupon.expiresAt) : null;
    const isExpired = expiresAt ? expiresAt.getTime() <= Date.now() : false;
    const isUsed = Boolean(coupon.isUsed);

    return {
        code: coupon.code,
        discountPercent: Number(coupon.discountPercent || 0),
        minOrderAmount: Number(coupon.minOrderAmount || 0),
        expiresAt: coupon.expiresAt,
        createdAt: coupon.createdAt,
        usedAt: coupon.usedAt,
        isUsed,
        status: isUsed ? 'USED' : isExpired ? 'EXPIRED' : 'ACTIVE',
    };
};

const buildMission = ({ key, title, description, current, target, actionLabel, actionPath }) => {
    const safeCurrent = Math.min(Math.max(Number(current || 0), 0), target);
    const completed = safeCurrent >= target;

    return {
        key,
        title,
        description,
        current: safeCurrent,
        target,
        completed,
        progressPercent: Math.round((safeCurrent / target) * 100),
        actionLabel,
        actionPath,
    };
};

const mapRewardHistory = (review) => {
    const reward = review.reward || {};

    return {
        id: review._id,
        type: reward.rewardType,
        title: reward.rewardType === 'COUPON'
            ? `Nhận voucher ${reward.discountPercent || 0}%`
            : `Nhận ${reward.points || 0} điểm tích lũy`,
        description: `Đánh giá sản phẩm ${review.productSnapshot?.name || 'đã mua'} từ đơn ${review.orderCode}`,
        points: reward.points || 0,
        couponCode: reward.couponCode || '',
        createdAt: review.createdAt,
    };
};

export const getMyLoyaltySummary = async (userId) => {
    if (!mongoose.isValidObjectId(userId)) {
        throw createServiceError(400, 'Người dùng không hợp lệ', 'INVALID_USER_ID');
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const [user, deliveredOrders, reviewCount, recentReviews] = await Promise.all([
        User.findById(userId).select('firstName lastName email rewardPoints rewardCoupons favoriteProducts').lean(),
        Order.countDocuments({ user: userObjectId, status: 'DELIVERED' }),
        Review.countDocuments({ user: userObjectId }),
        Review.find({ user: userObjectId })
            .sort({ createdAt: -1 })
            .limit(8)
            .select('orderCode productSnapshot reward createdAt')
            .lean(),
    ]);

    if (!user) {
        throw createServiceError(404, 'Không tìm thấy người dùng', 'USER_NOT_FOUND');
    }

    const rewardPoints = Number(user.rewardPoints || 0);
    const coupons = (user.rewardCoupons || []).map(mapCoupon);
    const activeCoupons = coupons.filter((coupon) => coupon.status === 'ACTIVE');
    const usedCoupons = coupons.filter((coupon) => coupon.status !== 'ACTIVE');
    const favoriteCount = Array.isArray(user.favoriteProducts) ? user.favoriteProducts.length : 0;

    return {
        profile: {
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            email: user.email,
        },
        rewardPoints,
        membership: getMembership(rewardPoints),
        coupons: {
            active: activeCoupons,
            inactive: usedCoupons,
            total: coupons.length,
        },
        missions: [
            buildMission({
                key: 'FIRST_DELIVERED_ORDER',
                title: 'Hoàn tất đơn hàng đầu tiên',
                description: 'Mua hàng và nhận đơn thành công để mở khóa quyền đánh giá nhận thưởng.',
                current: deliveredOrders,
                target: 1,
                actionLabel: 'Xem đơn hàng',
                actionPath: '/orders',
            }),
            buildMission({
                key: 'WRITE_REVIEW',
                title: 'Đánh giá sản phẩm đã mua',
                description: 'Review sau khi nhận hàng để nhận điểm hoặc voucher cá nhân.',
                current: reviewCount,
                target: 1,
                actionLabel: 'Đi tới đơn hàng',
                actionPath: '/orders',
            }),
            buildMission({
                key: 'SAVE_FAVORITES',
                title: 'Lưu sản phẩm yêu thích',
                description: 'Thêm ít nhất 3 sản phẩm vào danh sách yêu thích để cá nhân hóa trải nghiệm.',
                current: favoriteCount,
                target: 3,
                actionLabel: 'Tìm sản phẩm',
                actionPath: '/search',
            }),
            buildMission({
                key: 'WATCH_LIVE',
                title: 'Tham gia livestream',
                description: 'Theo dõi livestream để không bỏ lỡ ưu đãi và sản phẩm nổi bật.',
                current: 0,
                target: 1,
                actionLabel: 'Xem livestream',
                actionPath: '/livestream',
            }),
        ],
        stats: {
            deliveredOrders,
            reviews: reviewCount,
            favorites: favoriteCount,
            activeCoupons: activeCoupons.length,
        },
        rewardHistory: recentReviews.map(mapRewardHistory),
    };
};

export { LoyaltyServiceError };
