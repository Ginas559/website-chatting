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
    { key: 'BRONZE', name: 'Bronze', minSpend: 0, minOrders: 0 },
    { key: 'SILVER', name: 'Silver', minSpend: 20000000, minOrders: 1 },
    { key: 'GOLD', name: 'Gold', minSpend: 60000000, minOrders: 2 },
    { key: 'DIAMOND', name: 'Diamond', minSpend: 120000000, minOrders: 3 },
];

const MISSION_MILESTONES = [1, 3, 5, 10];

const startOfWeek = (date = new Date()) => {
    const value = new Date(date);
    const day = value.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    value.setHours(0, 0, 0, 0);
    value.setDate(value.getDate() + diffToMonday);
    return value;
};

const endOfWeek = (date = new Date()) => {
    const value = startOfWeek(date);
    value.setDate(value.getDate() + 7);
    return value;
};

const getNextMilestone = (count) => {
    const safeCount = Math.max(0, Number(count || 0));
    return MISSION_MILESTONES.find((target) => safeCount < target) || MISSION_MILESTONES[MISSION_MILESTONES.length - 1];
};

const getMembership = ({ totalSpend, deliveredOrders }) => {
    const safeSpend = Math.max(0, Number(totalSpend || 0));
    const safeOrders = Math.max(0, Number(deliveredOrders || 0));
    const currentIndex = LEVELS.reduce((matchedIndex, level, index) => (
        safeSpend >= level.minSpend && safeOrders >= level.minOrders ? index : matchedIndex
    ), 0);
    const current = LEVELS[currentIndex];
    const next = LEVELS[currentIndex + 1] || null;
    const spendProgress = next ? safeSpend / next.minSpend : 1;
    const orderProgress = next && next.minOrders > 0 ? safeOrders / next.minOrders : 1;
    const progressPercent = next ? Math.min(100, Math.round(Math.min(spendProgress, orderProgress) * 100)) : 100;

    return {
        current,
        next,
        progressPercent,
        spendToNext: next ? Math.max(0, next.minSpend - safeSpend) : 0,
        ordersToNext: next ? Math.max(0, next.minOrders - safeOrders) : 0,
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

const buildMission = ({ key, title, description, current, target, actionLabel, actionPath, resetAt, isWeekly = false }) => {
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
        resetAt,
        isWeekly,
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
    const weekStart = startOfWeek();
    const weekResetAt = endOfWeek();
    const deliveredFilter = { user: userObjectId, status: 'DELIVERED' };
    const [user, deliveredStats, reviewCount, weeklyDeliveredOrders, weeklyReviewCount, recentReviews] = await Promise.all([
        User.findById(userId).select('firstName lastName email rewardPoints rewardCoupons favoriteProducts').lean(),
        Order.aggregate([
            { $match: deliveredFilter },
            {
                $group: {
                    _id: '$user',
                    count: { $sum: 1 },
                    totalSpend: { $sum: '$totalAmount' },
                },
            },
        ]),
        Review.countDocuments({ user: userObjectId }),
        Order.countDocuments({ ...deliveredFilter, updatedAt: { $gte: weekStart } }),
        Review.countDocuments({ user: userObjectId, createdAt: { $gte: weekStart } }),
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
    const deliveredOrders = Number(deliveredStats[0]?.count || 0);
    const totalDeliveredSpend = Number(deliveredStats[0]?.totalSpend || 0);
    const weeklyDeliveredTarget = getNextMilestone(weeklyDeliveredOrders);
    const weeklyReviewTarget = getNextMilestone(weeklyReviewCount);
    const favoriteTarget = getNextMilestone(favoriteCount);

    return {
        profile: {
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            email: user.email,
        },
        rewardPoints,
        membership: getMembership({ totalSpend: totalDeliveredSpend, deliveredOrders }),
        coupons: {
            active: activeCoupons,
            inactive: usedCoupons,
            total: coupons.length,
        },
        missions: [
            buildMission({
                key: 'WEEKLY_DELIVERED_ORDER',
                title: 'Hoàn tất đơn hàng trong tuần',
                description: 'Mỗi tuần reset tiến độ. Đạt mốc cao hơn khi bạn hoàn thành nhiều đơn hơn.',
                current: weeklyDeliveredOrders,
                target: weeklyDeliveredTarget,
                actionLabel: 'Xem đơn hàng',
                actionPath: '/orders',
                resetAt: weekResetAt,
                isWeekly: true,
            }),
            buildMission({
                key: 'WEEKLY_REVIEW',
                title: 'Đánh giá sản phẩm trong tuần',
                description: 'Review sau khi nhận hàng để nhận điểm hoặc voucher cá nhân. Tiến độ reset mỗi tuần.',
                current: weeklyReviewCount,
                target: weeklyReviewTarget,
                actionLabel: 'Đi tới đơn hàng',
                actionPath: '/orders',
                resetAt: weekResetAt,
                isWeekly: true,
            }),
            buildMission({
                key: 'SAVE_FAVORITES',
                title: 'Lưu sản phẩm yêu thích',
                description: 'Mốc tăng dần theo tổng sản phẩm yêu thích vì hệ thống chưa lưu thời điểm thêm yêu thích.',
                current: favoriteCount,
                target: favoriteTarget,
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
            totalDeliveredSpend,
            weeklyDeliveredOrders,
            weeklyReviews: weeklyReviewCount,
            reviews: reviewCount,
            favorites: favoriteCount,
            activeCoupons: activeCoupons.length,
        },
        rewardHistory: recentReviews.map(mapRewardHistory),
    };
};

export { LoyaltyServiceError };
