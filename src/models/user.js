import mongoose from 'mongoose';

const rewardCouponSchema = new mongoose.Schema(
    {
        code: { type: String, required: true, trim: true },
        discountPercent: { type: Number, required: true, min: 0, max: 100 },
        minOrderAmount: { type: Number, default: 0, min: 0 },
        expiresAt: { type: Date, required: true },
        reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Review' },
        createdAt: { type: Date, default: Date.now },
        usedAt: { type: Date, default: null },
        isUsed: { type: Boolean, default: false },
    },
    { _id: false }
);

const userSchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        lowercase: true
    },
    password: { 
        type: String, 
        required: true 
    },
    firstName: { type: String, required: true},
    lastName: { type: String, required: true },
    address: { type: String },
    phoneNumber: { type: String },
    gender: { 
        type: Boolean, 
        default: false 
    },
    image: { type: String },
    roleId: { type: String, default: 'R2' },
    positionId: { type: String },
    isActive: { type: Boolean, default: false },
    rewardPoints: { type: Number, default: 0, min: 0 },
    rewardCoupons: { type: [rewardCouponSchema], default: [] },
    favoriteProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    recentlyViewedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
}, {
    timestamps: true 
});

const User = mongoose.model('User', userSchema);
export default User;