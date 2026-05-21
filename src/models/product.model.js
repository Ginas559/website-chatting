import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
        brand: { type: String, required: true, trim: true },
        category: { type: String, required: true, trim: true },
        image: { type: String, required: true, trim: true },
        images: { type: [String], default: [] },
        price: { type: Number, required: true, min: 0 },
        oldPrice: { type: Number, required: true, min: 0 },
        discount: { type: Number, default: 0, min: 0, max: 100 },
        stock: { type: Number, default: 0, min: 0 },
        soldCount: { type: Number, default: 0, min: 0 },
        rating: { type: Number, default: 4.5, min: 0, max: 5 },
        description: { type: String, default: '' },
        shortDescription: { type: String, default: '' },
        isPromotion: { type: Boolean, default: false },
        isLatest: { type: Boolean, default: false },
        isBestSeller: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
    },
    {
        timestamps: true,
    }
);

const Product = mongoose.model('Product', productSchema);

export default Product;