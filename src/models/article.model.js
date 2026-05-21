import mongoose from 'mongoose';

const articleSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
        category: { type: String, required: true, trim: true },
        author: { type: String, required: true, trim: true },
        coverImage: { type: String, required: true, trim: true },
        images: { type: [String], default: [] },
        summary: { type: String, default: '' },
        content: { type: String, default: '' },
        tags: { type: [String], default: [] },
        views: { type: Number, default: 0, min: 0 },
        isLatest: { type: Boolean, default: true },
        isActive: { type: Boolean, default: true },
    },
    {
        timestamps: true,
    }
);

const Article = mongoose.model('Article', articleSchema);

export default Article;