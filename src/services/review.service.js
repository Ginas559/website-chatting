import mongoose from 'mongoose';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import Review from '../models/review.model.js';
import User from '../models/user.js';
import { normalizeText } from './checkout.helper.js';
import { createNotification } from '../utils/notification';

const DEFAULT_REVIEW_PAGE_SIZE = 6;
const MAX_REVIEW_PAGE_SIZE = 20;
const REVIEW_WINDOW_DAYS = 30;
const COUPON_DISCOUNT_PERCENT = 10;
const COUPON_MIN_ORDER_AMOUNT = 500000;
const POINT_REWARD_BY_RATING = {
    1: 10,
    2: 15,
    3: 25,
    4: 50,
};

class ReviewServiceError extends Error {
    constructor(statusCode, message, code = 'REVIEW_ERROR', details = null) {
        super(message);
        this.name = 'ReviewServiceError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isReviewServiceError = true;
    }
}

const createServiceError = (statusCode, message, code = 'REVIEW_ERROR', details = null) => {
    return new ReviewServiceError(statusCode, message, code, details);
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
    const rawLimit = toPositiveInteger(limit, DEFAULT_REVIEW_PAGE_SIZE);
    const safeLimit = Math.min(Math.max(rawLimit, 1), MAX_REVIEW_PAGE_SIZE);

    return {
        page: safePage,
        limit: safeLimit,
        skip: (safePage - 1) * safeLimit,
    };
};

const normalizeRating = (value) => {
    const rating = Number(value);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw createServiceError(400, 'Đánh giá phải là số nguyên từ 1 đến 5 sao', 'INVALID_RATING');
    }

    return rating;
};

const buildProductSnapshot = (product) => ({
    name: product.name,
    slug: product.slug,
    image: product.image || (Array.isArray(product.images) && product.images[0]) || '',
    brand: product.brand,
    category: product.category,
});

const generateCouponCode = () => {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();

    return `RC${datePart}${randomPart}`;
};

const calculateReward = (rating) => {
    if (rating >= 5) {
        return {
            rewardType: 'COUPON',
            points: 0,
            couponCode: generateCouponCode(),
            discountPercent: COUPON_DISCOUNT_PERCENT,
            minOrderAmount: COUPON_MIN_ORDER_AMOUNT,
            expiresAt: new Date(Date.now() + REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000),
        };
    }

    return {
        rewardType: 'POINTS',
        points: POINT_REWARD_BY_RATING[rating] || 10,
        couponCode: '',
        discountPercent: 0,
        minOrderAmount: 0,
        expiresAt: null,
    };
};

const mapReview = (review) => {
    if (!review) {
        return null;
    }

    const user = review.user || {};

    return {
        id: review._id,
        orderId: review.order,
        orderCode: review.orderCode,
        productId: review.product,
        productSlug: review.productSnapshot?.slug || '',
        productSnapshot: review.productSnapshot,
        rating: review.rating,
        title: review.title,
        content: review.content,
        reward: review.reward,
        user: {
            id: user._id || user.id || null,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            image: user.image || '',
            roleId: user.roleId || '',
        },
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
    };
};

const aggregateReviewSummary = async (productId) => {
    const [summary] = await Review.aggregate([
        { $match: { product: new mongoose.Types.ObjectId(productId) } },
        {
            $group: {
                _id: '$product',
                totalReviews: { $sum: 1 },
                averageRating: { $avg: '$rating' },
                rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
                rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
                rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
                rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
                rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
            },
        },
    ]);

    const totalReviews = Number(summary?.totalReviews || 0);
    const averageRating = totalReviews > 0 ? Number(Number(summary?.averageRating || 0).toFixed(1)) : 0;

    return {
        totalReviews,
        averageRating,
        ratingBreakdown: {
            5: Number(summary?.rating5 || 0),
            4: Number(summary?.rating4 || 0),
            3: Number(summary?.rating3 || 0),
            2: Number(summary?.rating2 || 0),
            1: Number(summary?.rating1 || 0),
        },
    };
};

const findReviewableOrder = async ({ userId, productId, orderCode = '' }) => {
    const deliveredOrders = await Order.find({
        user: userId,
        status: 'DELIVERED',
        items: {
            $elemMatch: { product: productId },
        },
    })
        .sort({ createdAt: -1 })
        .select('orderCode createdAt items status')
        .lean();

    if (!deliveredOrders.length) {
        return null;
    }

    const normalizedOrderCode = normalizeText(orderCode).toUpperCase();

    for (const order of deliveredOrders) {
        if (normalizedOrderCode && order.orderCode !== normalizedOrderCode) {
            continue;
        }

        const existingReview = await Review.findOne({
            user: userId,
            order: order._id,
            product: productId,
        }).lean();

        if (!existingReview) {
            const orderItem = Array.isArray(order.items)
                ? order.items.find((item) => String(item.product) === String(productId))
                : null;

            return {
                order,
                orderItem,
            };
        }
    }

    return null;
};

const syncProductRating = async (productId, session) => {
    const [summary] = await Review.aggregate([
        { $match: { product: new mongoose.Types.ObjectId(productId) } },
        {
            $group: {
                _id: '$product',
                averageRating: { $avg: '$rating' },
            },
        },
    ]).session(session);

    const averageRating = summary ? Number(Number(summary.averageRating || 0).toFixed(1)) : 0;

    await Product.updateOne(
        { _id: productId },
        {
            $set: {
                rating: averageRating,
            },
        },
        { session }
    );
};

const normalizeReviewText = (value, maxLength) => {
    const text = normalizeText(value);

    if (text.length > maxLength) {
        throw createServiceError(400, `Nội dung không được vượt quá ${maxLength} ký tự`, 'INVALID_TEXT_LENGTH');
    }

    return text;
};

export const getProductReviewOverview = async ({ slug, page, limit, userId = null }) => {
    const product = await Product.findOne({ slug: normalizeText(slug), isActive: true }).lean();

    if (!product) {
        throw createServiceError(404, 'Không tìm thấy sản phẩm', 'PRODUCT_NOT_FOUND');
    }

    const pagination = parsePagination({ page, limit });
    const [summary, reviews, reviewableOrder, myReview] = await Promise.all([
        aggregateReviewSummary(product._id),
        Review.find({ product: product._id })
            .sort({ createdAt: -1 })
            .skip(pagination.skip)
            .limit(pagination.limit)
            .populate('user', 'firstName lastName image roleId')
            .lean(),
        userId ? findReviewableOrder({ userId, productId: product._id }) : Promise.resolve(null),
        userId
            ? Review.findOne({ user: userId, product: product._id }).sort({ createdAt: -1 }).lean()
            : Promise.resolve(null),
    ]);

    const total = summary.totalReviews;

    return {
        product: {
            id: product._id,
            slug: product.slug,
            name: product.name,
            image: product.image,
            brand: product.brand,
            category: product.category,
            price: product.price,
        },
        summary,
        reviews: reviews.map(mapReview),
        pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total,
            totalPages: total > 0 ? Math.ceil(total / pagination.limit) : 1,
        },
        canReview: Boolean(reviewableOrder),
        reviewableOrder: reviewableOrder
            ? {
                orderId: reviewableOrder.order._id,
                orderCode: reviewableOrder.order.orderCode,
                createdAt: reviewableOrder.order.createdAt,
            }
            : null,
        myReview: myReview ? mapReview(myReview) : null,
    };
};

export const createProductReview = async ({ userId, productSlug, orderCode, rating, title, content }) => {
    if (!mongoose.isValidObjectId(userId)) {
        throw createServiceError(400, 'Người dùng không hợp lệ', 'INVALID_OBJECT_ID');
    }

    const normalizedSlug = normalizeText(productSlug);
    if (!normalizedSlug) {
        throw createServiceError(400, 'Slug sản phẩm không hợp lệ', 'INVALID_PRODUCT_SLUG');
    }

    const product = await Product.findOne({ slug: normalizedSlug, isActive: true }).lean();
    if (!product) {
        throw createServiceError(404, 'Không tìm thấy sản phẩm', 'PRODUCT_NOT_FOUND');
    }

    const normalizedRating = normalizeRating(rating);
    const normalizedTitle = normalizeReviewText(title, 120);
    const normalizedContent = normalizeReviewText(content, 1000);

    if (normalizedContent.length < 2) {
        throw createServiceError(400, 'Nội dung đánh giá phải có ít nhất 2 ký tự', 'INVALID_REVIEW_CONTENT');
    }

    const reviewableOrder = await findReviewableOrder({
        userId,
        productId: product._id,
        orderCode,
    });

    if (!reviewableOrder) {
        throw createServiceError(
            403,
            'Chỉ đơn hàng đã giao thành công mới có thể đánh giá và mỗi đơn chỉ đánh giá một lần',
            'REVIEW_NOT_ALLOWED'
        );
    }

    const reward = calculateReward(normalizedRating);
    const session = await mongoose.startSession();

    try {
        let createdReview = null;
        let updatedUser = null;

        await session.withTransaction(async () => {
            const [review] = await Review.create([
                {
                    user: userId,
                    order: reviewableOrder.order._id,
                    orderCode: reviewableOrder.order.orderCode,
                    product: product._id,
                    productSnapshot: buildProductSnapshot(product),
                    rating: normalizedRating,
                    title: normalizedTitle,
                    content: normalizedContent,
                    reward,
                },
            ], { session });

            if (reward.rewardType === 'COUPON') {
                updatedUser = await User.findByIdAndUpdate(
                    userId,
                    {
                        $push: {
                            rewardCoupons: {
                                code: reward.couponCode,
                                discountPercent: reward.discountPercent,
                                minOrderAmount: reward.minOrderAmount,
                                expiresAt: reward.expiresAt,
                                reviewId: review._id,
                                createdAt: new Date(),
                                usedAt: null,
                                isUsed: false,
                            },
                        },
                    },
                    { new: true, session }
                ).select('-password');
            } else {
                updatedUser = await User.findByIdAndUpdate(
                    userId,
                    {
                        $inc: {
                            rewardPoints: reward.points,
                        },
                    },
                    { new: true, session }
                ).select('-password');
            }

            await syncProductRating(product._id, session);

            createdReview = review;
        });

        // Trigger Notification for Admin (R1) and Moderator (R3)
        createNotification({
            recipientRole: 'R1',
            type: 'NEW_REVIEW',
            title: 'Đánh giá sản phẩm mới',
            content: `Một đánh giá mới (${normalizedRating} sao) cho sản phẩm "${product.name}" vừa được gửi bởi người dùng.`,
            link: `/product/${product.slug}#reviews`
        }).catch(err => console.error('Review notification error:', err));

        return {
            review: mapReview(createdReview),
            reward: {
                ...reward,
                label: reward.rewardType === 'COUPON'
                    ? `Tặng mã giảm giá ${reward.discountPercent}%`
                    : `Tặng ${reward.points} điểm tích lũy`,
            },
            user: updatedUser ? {
                id: updatedUser._id,
                email: updatedUser.email,
                firstName: updatedUser.firstName,
                lastName: updatedUser.lastName,
                rewardPoints: updatedUser.rewardPoints || 0,
                rewardCoupons: Array.isArray(updatedUser.rewardCoupons) ? updatedUser.rewardCoupons : [],
            } : null,
        };
    } finally {
        await session.endSession();
    }
};

export { ReviewServiceError };