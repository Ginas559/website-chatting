import mongoose from 'mongoose';

const reviewProductSnapshotSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, trim: true },
        image: { type: String, required: true, trim: true },
        brand: { type: String, required: true, trim: true },
        category: { type: String, required: true, trim: true },
    },
    { _id: false }
);

const reviewRewardSchema = new mongoose.Schema(
    {
        rewardType: {
            type: String,
            enum: ['POINTS', 'COUPON'],
            required: true,
        },
        points: {
            type: Number,
            default: 0,
            min: 0,
        },
        couponCode: {
            type: String,
            default: '',
            trim: true,
        },
        discountPercent: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        minOrderAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        expiresAt: {
            type: Date,
            default: null,
        },
    },
    { _id: false }
);

const reviewSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
            index: true,
        },
        orderCode: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
            index: true,
        },
        productSnapshot: {
            type: reviewProductSnapshotSchema,
            required: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        title: {
            type: String,
            default: '',
            trim: true,
        },
        content: {
            type: String,
            default: '',
            trim: true,
        },
        reward: {
            type: reviewRewardSchema,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

reviewSchema.index({ user: 1, order: 1, product: 1 }, { unique: true });
reviewSchema.index({ product: 1, createdAt: -1 });

const Review = mongoose.model('Review', reviewSchema);

export default Review;