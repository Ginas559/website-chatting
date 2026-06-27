import mongoose from 'mongoose';

const orderItemSnapshotSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, trim: true },
        image: { type: String, required: true, trim: true },
        price: { type: Number, required: true, min: 0 },
        brand: { type: String, required: true, trim: true },
        category: { type: String, required: true, trim: true },
        color: { type: String, trim: true, default: '' },
        capacity: { type: String, trim: true, default: '' },
    },
    { _id: false }
);

const orderItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0,
        },
        lineTotal: {
            type: Number,
            required: true,
            min: 0,
        },
        snapshot: {
            type: orderItemSnapshotSchema,
            required: true,
        },
    },
    { _id: false }
);

const shippingInfoSchema = new mongoose.Schema(
    {
        fullName: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        address: { type: String, required: true, trim: true },
        city: { type: String, default: '', trim: true },
        note: { type: String, default: '', trim: true },
    },
    { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
    {
        status: { type: String, required: true, trim: true },
        note: { type: String, default: '', trim: true },
        changedAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const paymentInfoSchema = new mongoose.Schema(
    {
        provider: { type: String, default: '', trim: true },
        transactionNo: { type: String, default: '', trim: true },
        bankCode: { type: String, default: '', trim: true },
        cardType: { type: String, default: '', trim: true },
        responseCode: { type: String, default: '', trim: true },
        transactionStatus: { type: String, default: '', trim: true },
        payDate: { type: String, default: '', trim: true },
        lastVerifiedAt: { type: Date },
        returnVerifiedSuccess: { type: Boolean, default: false },
        returnVerifiedAt: { type: Date },
    },
    { _id: false }
);

const deliveryVerificationSchema = new mongoose.Schema(
    {
        tokenHash: { type: String, default: '', select: false },
        encryptedToken: { type: String, default: '', select: false },
        encryptionIv: { type: String, default: '', select: false },
        encryptionAuthTag: { type: String, default: '', select: false },
        generatedAt: { type: Date },
        expiresAt: { type: Date },
        revokedAt: { type: Date },
        lastVerifiedAt: { type: Date },
        verificationCount: { type: Number, default: 0, min: 0 },
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        orderCode: { type: String, required: true, unique: true, trim: true },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        items: {
            type: [orderItemSchema],
            required: true,
            validate: {
                validator: (items) => Array.isArray(items) && items.length > 0,
                message: 'Đơn hàng phải có ít nhất một sản phẩm',
            },
        },
        shippingInfo: {
            type: shippingInfoSchema,
            required: true,
        },
        subtotal: { type: Number, required: true, min: 0 },
        shippingFee: { type: Number, default: 0, min: 0 },
        totalAmount: { type: Number, required: true, min: 0 },
        paymentMethod: {
            type: String,
            enum: ['COD', 'VNPAY'],
            default: 'COD',
            required: true,
        },
        paymentStatus: {
            type: String,
            enum: ['UNPAID', 'PAID', 'FAILED', 'REFUND_REQUIRED', 'REFUNDED'],
            default: 'UNPAID',
            required: true,
        },
        paymentInfo: {
            type: paymentInfoSchema,
            default: () => ({}),
        },
        status: {
            type: String,
            enum: ['PENDING_PAYMENT', 'NEW', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED', 'CANCEL_REQUESTED'],
            default: 'NEW',
            required: true,
        },
        statusHistory: {
            type: [statusHistorySchema],
            default: () => [{ status: 'NEW', note: 'Đơn hàng mới được tạo', changedAt: new Date() }],
        },
        riskScore: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        riskLevel: {
            type: String,
            enum: ['LOW', 'MEDIUM', 'HIGH'],
            default: 'LOW',
        },
        riskReasons: {
            type: [String],
            default: [],
        },
        isSuspicious: {
            type: Boolean,
            default: false,
        },
        fraudProbability: {
            type: Number,
            default: 0,
            min: 0,
            max: 1,
        },
        riskSource: {
            type: String,
            enum: ['AI_MODEL', 'FALLBACK_RULE', 'FALLBACK_DEFAULT'],
            default: 'FALLBACK_DEFAULT',
        },
        deliveryVerification: {
            type: deliveryVerificationSchema,
            default: () => ({}),
        },
        couponCode: { type: String, default: '', trim: true },
        discountAmount: { type: Number, default: 0, min: 0 },
    },
    {
        timestamps: true,
    }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ riskLevel: 1, createdAt: -1 });
orderSchema.index({ isSuspicious: 1, createdAt: -1 });
orderSchema.index({ 'deliveryVerification.tokenHash': 1 }, { sparse: true });

const Order = mongoose.model('Order', orderSchema);

export default Order;
