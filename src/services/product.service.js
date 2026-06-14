import Product from '../models/product.model';
import User from '../models/user.js';
import Order from '../models/order.model.js';
import Review from '../models/review.model.js';
import mongoose from 'mongoose';

const PRODUCT_SELECT_FIELDS =
    'name slug brand category image images price oldPrice discount stock soldCount rating views description shortDescription isPromotion isLatest isBestSeller isActive isDeleted createdAt updatedAt';

const DEFAULT_PAGE = 1;
const DEFAULT_SEARCH_PAGE_SIZE = 12;
const DEFAULT_HOME_SECTION_PAGE_SIZE = 10;
const MAX_SEARCH_PAGE_SIZE = 12;
const MAX_HOME_SECTION_PAGE_SIZE = 10;
const RELATED_PRODUCTS_LIMIT = 8;
const RECENTLY_VIEWED_LIMIT = 20;

const mapProduct = (product, stats = {}) => ({
    id: product?._id ? String(product._id) : (product?.id ? String(product.id) : ''),
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
    views: product.views || 0,
    rating: product.rating,
    description: product.description || product.shortDescription,
    shortDescription: product.shortDescription,
    isPromotion: product.isPromotion,
    isLatest: product.isLatest,
    isBestSeller: product.isBestSeller,
    buyerCount: Number(stats.buyerCount || product.buyerCount || 0),
    commentCount: Number(stats.commentCount || product.commentCount || 0),
});

const objectIdFrom = (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return new mongoose.Types.ObjectId(id);
};

const getProductStatsMap = async (productIds = []) => {
    const ids = productIds.map((id) => String(id)).filter(Boolean);
    if (!ids.length) return {};
    const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));

    const [buyerStats, commentStats] = await Promise.all([
        Order.aggregate([
            { $match: { status: 'DELIVERED', 'items.product': { $in: objectIds } } },
            { $unwind: '$items' },
            { $match: { 'items.product': { $in: objectIds } } },
            { $group: { _id: '$items.product', users: { $addToSet: '$user' } } },
            { $project: { _id: 1, buyerCount: { $size: '$users' } } },
        ]),
        Review.aggregate([
            { $match: { product: { $in: objectIds } } },
            { $group: { _id: '$product', commentCount: { $sum: 1 } } },
        ]),
    ]);

    const statsMap = {};
    ids.forEach((id) => {
        statsMap[id] = { buyerCount: 0, commentCount: 0 };
    });

    buyerStats.forEach((item) => {
        const key = String(item._id);
        statsMap[key] = {
            ...(statsMap[key] || {}),
            buyerCount: Number(item.buyerCount || 0),
        };
    });

    commentStats.forEach((item) => {
        const key = String(item._id);
        statsMap[key] = {
            ...(statsMap[key] || {}),
            commentCount: Number(item.commentCount || 0),
        };
    });

    return statsMap;
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const makeSlug = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const ensureUniqueSlug = async (name, ignoredId = null) => {
    const baseSlug = makeSlug(name) || `product-${Date.now()}`;
    let slug = baseSlug;
    let counter = 1;

    while (await Product.exists({ slug, ...(ignoredId ? { _id: { $ne: ignoredId } } : {}) })) {
        slug = `${baseSlug}-${counter}`;
        counter += 1;
    }

    return slug;
};

const mapAdminProduct = (product) => ({
    _id: String(product._id),
    id: String(product._id),
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    category: product.category,
    image: product.image,
    images: Array.isArray(product.images) ? product.images : [],
    price: product.oldPrice || product.price,
    salePrice: product.price,
    oldPrice: product.oldPrice,
    stock: product.stock,
    soldCount: product.soldCount,
    description: product.description,
    shortDescription: product.shortDescription,
    status: product.isActive ? 'ACTIVE' : 'INACTIVE',
    isActive: product.isActive,
    isPromotion: product.isPromotion,
    isLatest: product.isLatest,
    isBestSeller: product.isBestSeller,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
});

const normalizeAdminProductPayload = (payload = {}) => {
    const price = Number(payload.price);
    const salePrice = payload.salePrice === undefined || payload.salePrice === null || payload.salePrice === ''
        ? price
        : Number(payload.salePrice);
    const images = Array.isArray(payload.images)
        ? payload.images.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
    const mainImage = String(payload.image || images[0] || '').trim();

    return {
        name: String(payload.name || '').trim(),
        brand: String(payload.brand || '').trim(),
        category: String(payload.category || '').trim(),
        image: mainImage || 'https://via.placeholder.com/600x600?text=SmartZone',
        images: mainImage && !images.includes(mainImage) ? [mainImage, ...images] : images,
        price: salePrice,
        oldPrice: price,
        discount: price > 0 ? Math.max(0, Math.round(((price - salePrice) / price) * 100)) : 0,
        stock: Number(payload.stock || 0),
        description: String(payload.description || '').trim(),
        shortDescription: String(payload.shortDescription || payload.description || '').trim(),
        isActive: (payload.status || 'ACTIVE') === 'ACTIVE',
        isPromotion: Boolean(payload.isPromotion),
        isLatest: Boolean(payload.isLatest),
        isBestSeller: Boolean(payload.isBestSeller),
    };
};

const toPositiveInteger = (value, fallback) => {
    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue)) {
        return fallback;
    }

    return Math.trunc(parsedValue);
};

const parsePagination = ({ page, limit, defaultLimit, maxLimit }) => {
    const safePage = Math.max(toPositiveInteger(page, DEFAULT_PAGE), DEFAULT_PAGE);
    const rawLimit = toPositiveInteger(limit, defaultLimit);
    const safeLimit = Math.min(Math.max(rawLimit, 1), maxLimit);
    const skip = (safePage - 1) * safeLimit;

    return {
        page: safePage,
        limit: safeLimit,
        skip,
    };
};

const buildPagination = (page, limit, total) => ({
    page,
    limit,
    total,
    totalPages: total > 0 ? Math.ceil(total / limit) : 1,
});

const getPaginatedProducts = async ({ filter, sort, page, limit, defaultLimit, maxLimit }) => {
    const paginationInput = parsePagination({
        page,
        limit,
        defaultLimit,
        maxLimit,
    });

    const [total, products] = await Promise.all([
        Product.countDocuments(filter),
        Product.find(filter)
            .sort(sort)
            .skip(paginationInput.skip)
            .limit(paginationInput.limit)
            .select(PRODUCT_SELECT_FIELDS)
            .lean(),
    ]);

    const statsMap = await getProductStatsMap(products.map((item) => item._id));
    const items = products.map((product) => mapProduct(product, statsMap[String(product._id)]));
    const pagination = buildPagination(paginationInput.page, paginationInput.limit, total);

    return {
        items,
        total,
        hasMore: paginationInput.skip + items.length < total,
        pagination,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: pagination.totalPages,
    };
};

const buildSearchFilter = (query = {}) => {
    const filter = { isActive: true, isDeleted: { $ne: true } };
    const {
        q,
        category,
        categoryIds,
        minPrice,
        maxPrice,
        minRating,
        inStock,
        promotion,
        latest,
        bestseller,
    } = query;

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

        if (minPrice) {
            filter.price.$gte = Number(minPrice);
        }

        if (maxPrice) {
            filter.price.$lte = Number(maxPrice);
        }
    }

    if (minRating) {
        filter.rating = { $gte: Number(minRating) };
    }

    if (inStock === 'true') {
        filter.stock = { $gt: 0 };
    }

    if (promotion === 'true') {
        filter.isPromotion = true;
    }

    if (latest === 'true') {
        filter.isLatest = true;
    }

    if (bestseller === 'true') {
        filter.isBestSeller = true;
    }

    return filter;
};

const buildSearchSort = (sort) => {
    switch (sort) {
        case 'price-asc':
            return { price: 1 };
        case 'price-desc':
            return { price: -1 };
        case 'popular':
            return { soldCount: -1, views: -1, rating: -1 };
        case 'rating':
            return { rating: -1, soldCount: -1, views: -1 };
        default:
            return { createdAt: -1 };
    }
};

export const getProductCategories = async () => {
    const categories = await Product.distinct('category', { isActive: true });
    return categories.filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'));
};

export const getProductsSearchService = async (query = {}) => {
    const filter = buildSearchFilter(query);
    const sortOption = buildSearchSort(query.sort);
    const paginatedProducts = await getPaginatedProducts({
        filter,
        sort: sortOption,
        page: query.page,
        limit: query.limit,
        defaultLimit: DEFAULT_SEARCH_PAGE_SIZE,
        maxLimit: MAX_SEARCH_PAGE_SIZE,
    });

    return {
        ...paginatedProducts,
    };
};

const getPagedSectionProducts = async ({ filter, sort, page = 1, limit = DEFAULT_HOME_SECTION_PAGE_SIZE }) => {
    return getPaginatedProducts({
        filter,
        sort,
        page,
        limit,
        defaultLimit: DEFAULT_HOME_SECTION_PAGE_SIZE,
        maxLimit: MAX_HOME_SECTION_PAGE_SIZE,
    });
};

export const getHomeSections = async ({ limit = DEFAULT_HOME_SECTION_PAGE_SIZE, promotionPage = 1, latestPage = 1, bestsellerPage = 1, mostViewedPage = 1 } = {}) => {
    const safeLimit = Math.min(Math.max(toPositiveInteger(limit, DEFAULT_HOME_SECTION_PAGE_SIZE), 1), MAX_HOME_SECTION_PAGE_SIZE);

    const [promotion, latest, bestseller, mostViewed] = await Promise.all([
        getPagedSectionProducts({
            filter: { isActive: true, isDeleted: { $ne: true }, isPromotion: true },
            sort: { discount: -1, createdAt: -1 },
            page: promotionPage,
            limit: safeLimit,
        }),
        getPagedSectionProducts({
            filter: { isActive: true, isDeleted: { $ne: true }, isLatest: true },
            sort: { createdAt: -1 },
            page: latestPage,
            limit: safeLimit,
        }),
        getPagedSectionProducts({
            filter: { isActive: true, isDeleted: { $ne: true }, isBestSeller: true },
            sort: { soldCount: -1, rating: -1, createdAt: -1 },
            page: bestsellerPage,
            limit: safeLimit,
        }),
        getPagedSectionProducts({
            filter: { isActive: true, isDeleted: { $ne: true } },
            sort: { views: -1, soldCount: -1, rating: -1, createdAt: -1 },
            page: mostViewedPage,
            limit: safeLimit,
        }),
    ]);

    return {
        promotion,
        latest,
        bestseller,
        mostViewed,
    };
};

export const getBestSellerProducts = async ({ page = 1, limit = DEFAULT_HOME_SECTION_PAGE_SIZE } = {}) => {
    return getPagedSectionProducts({
        filter: { isActive: true, isDeleted: { $ne: true }, isBestSeller: true },
        sort: { soldCount: -1, views: -1, rating: -1 },
        page,
        limit,
    });
};

export const getMostViewedProducts = async ({ page = 1, limit = DEFAULT_HOME_SECTION_PAGE_SIZE } = {}) => {
    return getPagedSectionProducts({
        filter: { isActive: true, isDeleted: { $ne: true } },
        sort: { views: -1, soldCount: -1, rating: -1 },
        page,
        limit,
    });
};

export const getProductDetailBySlug = async (slug) => {
    const product = await Product.findOneAndUpdate(
        { slug, isActive: true, isDeleted: { $ne: true } },
        { $inc: { views: 1 } },
        { new: true }
    )
        .select(PRODUCT_SELECT_FIELDS)
        .lean();

    if (!product) {
        return null;
    }

    const relatedProducts = await Product.find({
        isActive: true,
        isDeleted: { $ne: true },
        slug: { $ne: slug },
        category: product.category,
    })
        .sort({ soldCount: -1, rating: -1 })
        .limit(RELATED_PRODUCTS_LIMIT)
        .select(PRODUCT_SELECT_FIELDS)
        .lean();

    const statsMap = await getProductStatsMap([product._id, ...relatedProducts.map((item) => item._id)]);

    return {
        product: mapProduct(product, statsMap[String(product._id)]),
        related: relatedProducts.map((item) => mapProduct(item, statsMap[String(item._id)])),
    };
};

export const toggleFavoriteProductService = async ({ userId, productId }) => {
    const userObjectId = objectIdFrom(userId);
    const productObjectId = objectIdFrom(productId);

    if (!userObjectId || !productObjectId) {
        return { invalid: true };
    }

    const [user, product] = await Promise.all([
        User.findById(userObjectId).select('favoriteProducts'),
        Product.findOne({ _id: productObjectId, isActive: true, isDeleted: { $ne: true } }).select('_id'),
    ]);

    if (!user || !product) {
        return { invalid: true };
    }

    const currentFavorites = Array.isArray(user.favoriteProducts)
        ? user.favoriteProducts.map((id) => String(id))
        : [];
    const nextIsFavorite = !currentFavorites.includes(String(productObjectId));

    await User.updateOne(
        { _id: userObjectId },
        nextIsFavorite
            ? { $addToSet: { favoriteProducts: productObjectId } }
            : { $pull: { favoriteProducts: productObjectId } }
    );

    const updatedUser = await User.findById(userObjectId).select('favoriteProducts').lean();
    const favoriteProductIds = Array.isArray(updatedUser?.favoriteProducts)
        ? updatedUser.favoriteProducts.map((id) => String(id))
        : [];

    let favoriteProducts = [];
    if (favoriteProductIds.length) {
        const products = await Product.find({
            _id: { $in: favoriteProductIds.map((id) => new mongoose.Types.ObjectId(id)) },
            isActive: true,
            isDeleted: { $ne: true },
        })
            .select(PRODUCT_SELECT_FIELDS)
            .lean();

        const productMap = new Map(products.map((item) => [String(item._id), item]));
        const orderedProducts = favoriteProductIds
            .map((id) => productMap.get(id))
            .filter(Boolean);
        const statsMap = await getProductStatsMap(orderedProducts.map((item) => item._id));
        favoriteProducts = orderedProducts.map((item) => mapProduct(item, statsMap[String(item._id)]));
    }

    return {
        invalid: false,
        isFavorite: nextIsFavorite,
        favoriteProductIds,
        favoriteProducts,
    };
};

export const getFavoriteProductsService = async ({ userId }) => {
    const userObjectId = objectIdFrom(userId);
    if (!userObjectId) return null;

    const user = await User.findById(userObjectId).select('favoriteProducts').lean();
    if (!user) return null;

    const favoriteProductIds = Array.isArray(user.favoriteProducts)
        ? user.favoriteProducts.map((id) => String(id))
        : [];

    if (!favoriteProductIds.length) {
        return { favoriteProductIds: [], items: [] };
    }

    const products = await Product.find({
            _id: { $in: favoriteProductIds.map((id) => new mongoose.Types.ObjectId(id)) },
            isActive: true,
            isDeleted: { $ne: true },
    })
        .select(PRODUCT_SELECT_FIELDS)
        .lean();

    const productMap = new Map(products.map((item) => [String(item._id), item]));
    const orderedProducts = favoriteProductIds.map((id) => productMap.get(id)).filter(Boolean);
    const statsMap = await getProductStatsMap(orderedProducts.map((item) => item._id));
    const items = orderedProducts.map((item) => mapProduct(item, statsMap[String(item._id)]));

    return {
        favoriteProductIds,
        items,
    };
};

export const addRecentlyViewedProductService = async ({ userId, slug }) => {
    const userObjectId = objectIdFrom(userId);
    if (!userObjectId || !slug) return null;

    const product = await Product.findOne({ slug, isActive: true, isDeleted: { $ne: true } }).select('_id').lean();
    if (!product?._id) return null;

    const productId = String(product._id);
    const user = await User.findById(userObjectId).select('recentlyViewedProducts').lean();
    if (!user) return null;

    const viewed = Array.isArray(user.recentlyViewedProducts)
        ? user.recentlyViewedProducts.map((id) => String(id)).filter((id) => id !== productId)
        : [];
    const nextViewed = [productId, ...viewed].slice(0, RECENTLY_VIEWED_LIMIT);

    await User.updateOne({ _id: userObjectId }, { recentlyViewedProducts: nextViewed });

    return { productId };
};

export const getRecentlyViewedProductsService = async ({ userId }) => {
    const userObjectId = objectIdFrom(userId);
    if (!userObjectId) return null;

    const user = await User.findById(userObjectId).select('recentlyViewedProducts').lean();
    if (!user) return null;

    const ids = Array.isArray(user.recentlyViewedProducts) ? user.recentlyViewedProducts.map((id) => String(id)) : [];
    if (!ids.length) {
        return { items: [] };
    }

    const products = await Product.find({
            _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
            isActive: true,
            isDeleted: { $ne: true },
    })
        .select(PRODUCT_SELECT_FIELDS)
        .lean();

    const mapById = new Map(products.map((item) => [String(item._id), item]));
    const ordered = ids.map((id) => mapById.get(id)).filter(Boolean);
    const statsMap = await getProductStatsMap(ordered.map((item) => item._id));

    return {
        items: ordered.map((item) => mapProduct(item, statsMap[String(item._id)])),
    };
};

export const getAdminProductsService = async (query = {}) => {
    const page = Math.max(toPositiveInteger(query.page, 1), 1);
    const limit = Math.min(Math.max(toPositiveInteger(query.limit, 10), 1), 100);
    const filter = { isDeleted: { $ne: true } };

    if (query.keyword) {
        const keyword = escapeRegExp(String(query.keyword).trim());
        filter.$or = [
            { name: { $regex: keyword, $options: 'i' } },
            { brand: { $regex: keyword, $options: 'i' } },
            { category: { $regex: keyword, $options: 'i' } },
        ];
    }

    if (query.category) filter.category = String(query.category).trim();
    if (query.status === 'ACTIVE') filter.isActive = true;
    if (query.status === 'INACTIVE') filter.isActive = false;
    if (query.lowStock === 'true') filter.stock = { $lte: Number(query.lowStockThreshold || 5) };

    const skip = (page - 1) * limit;
    const [totalItems, products] = await Promise.all([
        Product.countDocuments(filter),
        Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    return {
        items: products.map(mapAdminProduct),
        pagination: {
            page,
            limit,
            totalItems,
            totalPages: totalItems > 0 ? Math.ceil(totalItems / limit) : 1,
        },
    };
};

export const createAdminProductService = async (payload, actorId) => {
    const data = normalizeAdminProductPayload(payload);
    const slug = await ensureUniqueSlug(data.name);
    const product = await Product.create({ ...data, slug, createdBy: actorId, updatedBy: actorId });
    return mapAdminProduct(product);
};

export const updateAdminProductService = async (id, payload, actorId) => {
    const product = await Product.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!product) return null;

    const data = normalizeAdminProductPayload({ ...product.toObject(), ...payload });
    if (payload.name && payload.name !== product.name) {
        data.slug = await ensureUniqueSlug(payload.name, id);
    }

    Object.assign(product, data, { updatedBy: actorId });
    await product.save();
    return mapAdminProduct(product);
};

export const updateAdminProductStatusService = async (id, status, actorId) => {
    const product = await Product.findOneAndUpdate(
        { _id: id, isDeleted: { $ne: true } },
        { isActive: status === 'ACTIVE', updatedBy: actorId },
        { new: true }
    ).lean();
    return product ? mapAdminProduct(product) : null;
};

export const softDeleteAdminProductService = async (id, actorId) => {
    const product = await Product.findOneAndUpdate(
        { _id: id, isDeleted: { $ne: true } },
        { isDeleted: true, isActive: false, updatedBy: actorId },
        { new: true }
    ).lean();
    return product ? mapAdminProduct(product) : null;
};
