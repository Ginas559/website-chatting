import Product from '../models/product.model';

const PRODUCT_SELECT_FIELDS =
    'name slug brand category image images price oldPrice discount stock soldCount rating description shortDescription isPromotion isLatest isBestSeller';

const mapProduct = (product) => ({
    id: product._id,
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    category: product.category,
    image: product.image,
    images: Array.isArray(product.images) && product.images.length ? product.images : [product.image].filter(Boolean),
    price: product.price,
    oldPrice: product.oldPrice,
    discount: product.discount,
    stock: product.stock,
    sold: product.soldCount,
    rating: product.rating,
    description: product.description || product.shortDescription,
    shortDescription: product.shortDescription,
    isPromotion: product.isPromotion,
    isLatest: product.isLatest,
    isBestSeller: product.isBestSeller,
});

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getProductCategories = async () => {
    const categories = await Product.distinct('category', { isActive: true });
    return categories.filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'));
};

export const getProductsSearchService = async (query = {}) => {
    const {
        q,
        category,
        categoryIds,
        minPrice,
        maxPrice,
        minRating,
        inStock,
        sort,
        promotion,
        latest,
        bestseller,
    } = query;

    const filter = { isActive: true };

    if (q) {
        const rawQuery = String(q).trim();
        const searchTerms = [...new Set([rawQuery, ...rawQuery.split(/\s+/).filter(Boolean)])];

        filter.$or = searchTerms.flatMap((term) => {
            const escapedTerm = escapeRegExp(term);

            return [
                { name: { $regex: escapedTerm, $options: 'i' } },
                { brand: { $regex: escapedTerm, $options: 'i' } },
                { category: { $regex: escapedTerm, $options: 'i' } },
                { shortDescription: { $regex: escapedTerm, $options: 'i' } },
            ];
        });
    }

    if (category) {
        filter.category = category;
    }

    if (categoryIds) {
        const categories = String(categoryIds)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

        if (categories.length) {
            filter.category = { $in: categories };
        }
    }

    if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = Number(minPrice);
        if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (minRating) filter.rating = { $gte: Number(minRating) };
    if (inStock === 'true') filter.stock = { $gt: 0 };
    if (promotion === 'true') filter.isPromotion = true;
    if (latest === 'true') filter.isLatest = true;
    if (bestseller === 'true') filter.isBestSeller = true;

    const sortOption = (() => {
        switch (sort) {
            case 'price-asc':
                return { price: 1 };
            case 'price-desc':
                return { price: -1 };
            case 'popular':
                return { soldCount: -1 };
            case 'rating':
                return { rating: -1 };
            default:
                return { createdAt: -1 };
        }
    })();

    const products = await Product.find(filter)
        .sort(sortOption)
        .select(PRODUCT_SELECT_FIELDS)
        .lean();

    return products.map(mapProduct);
};

export const getHomeSections = async (limit = 8) => {
    const [promotion, latest, bestseller] = await Promise.all([
        Product.find({ isActive: true, isPromotion: true })
            .sort({ discount: -1, createdAt: -1 })
            .limit(limit)
            .select(PRODUCT_SELECT_FIELDS)
            .lean(),
        Product.find({ isActive: true, isLatest: true })
            .sort({ createdAt: -1 })
            .limit(limit)
            .select(PRODUCT_SELECT_FIELDS)
            .lean(),
        Product.find({ isActive: true, isBestSeller: true })
            .sort({ soldCount: -1, rating: -1 })
            .limit(limit)
            .select(PRODUCT_SELECT_FIELDS)
            .lean(),
    ]);

    return {
        promotion: promotion.map(mapProduct),
        latest: latest.map(mapProduct),
        bestseller: bestseller.map(mapProduct),
    };
};

export const getProductDetailBySlug = async (slug) => {
    const product = await Product.findOne({ slug, isActive: true })
        .select(PRODUCT_SELECT_FIELDS)
        .lean();

    if (!product) {
        return null;
    }

    const relatedProducts = await Product.find({
        isActive: true,
        slug: { $ne: slug },
        category: product.category,
    })
        .sort({ soldCount: -1, rating: -1 })
        .limit(8)
        .select(PRODUCT_SELECT_FIELDS)
        .lean();

    return {
        product: mapProduct(product),
        related: relatedProducts.map(mapProduct),
    };
};