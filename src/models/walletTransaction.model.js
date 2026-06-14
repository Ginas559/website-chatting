import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema(
    {
        order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
        orderCode: { type: String, required: true, trim: true },
        type: {
            type: String,
            enum: ['ORDER_REVENUE'],
            default: 'ORDER_REVENUE',
            required: true,
        },
        amount: { type: Number, required: true, min: 0 },
        status: {
            type: String,
            enum: ['AVAILABLE', 'REFUND_REQUIRED', 'REFUNDED'],
            default: 'AVAILABLE',
            required: true,
        },
        availableAt: { type: Date, default: Date.now },
        note: { type: String, default: '', trim: true },
    },
    { timestamps: true }
);

walletTransactionSchema.index({ status: 1, createdAt: -1 });

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);

export default WalletTransaction;
