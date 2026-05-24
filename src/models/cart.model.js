import mongoose from 'mongoose';

const cartSnapshotSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        image: { type: String, required: true, trim: true },
        price: { type: Number, required: true, min: 0 },
        brand: { type: String, required: true, trim: true },
    },
    { _id: false }
);

const cartItemSchema = new mongoose.Schema(
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
            default: 1,
        },
        snapshot: {
            type: cartSnapshotSchema,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

const cartSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true,
        },
        items: {
            type: [cartItemSchema],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

cartSchema.index({ user: 1 }, { unique: true });
cartSchema.index({ updatedAt: -1 });

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;