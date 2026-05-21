import Product from '../models/product.model';

const PRODUCT_SELECT_FIELDS =
    'name slug brand category image images price oldPrice discount stock soldCount rating views description shortDescription isPromotion isLatest isBestSeller';

const DEFAULT_PAGE = 1;
const DEFAULT_SEARCH_PAGE_SIZE = 12;
const DEFAULT_HOME_SECTION_PAGE_SIZE = 10;
const MAX_SEARCH_PAGE_SIZE = 12;
const MAX_HOME_SECTION_PAGE_SIZE = 10;
const RELATED_PRODUCTS_LIMIT = 8;

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
    views: product.views || 0,
    rating: product.rating,
    description: product.description || product.shortDescription,
    shortDescription: product.shortDescription,
    isPromotion: product.isPromotion,
    isLatest: product.isLatest,
    isBestSeller: product.isBestSeller,
});

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

    const items = products.map(mapProduct);
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
    const filter = { isActive: true };
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
            filter: { isActive: true, isPromotion: true },
            sort: { discount: -1, createdAt: -1 },
            page: promotionPage,
            limit: safeLimit,
        }),
        getPagedSectionProducts({
            filter: { isActive: true, isLatest: true },
            sort: { createdAt: -1 },
            page: latestPage,
            limit: safeLimit,
        }),
        getPagedSectionProducts({
            filter: { isActive: true, isBestSeller: true },
            sort: { soldCount: -1, rating: -1, createdAt: -1 },
            page: bestsellerPage,
            limit: safeLimit,
        }),
        getPagedSectionProducts({
            filter: { isActive: true },
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
        filter: { isActive: true, isBestSeller: true },
        sort: { soldCount: -1, views: -1, rating: -1 },
        page,
        limit,
    });
};

export const getMostViewedProducts = async ({ page = 1, limit = DEFAULT_HOME_SECTION_PAGE_SIZE } = {}) => {
    return getPagedSectionProducts({
        filter: { isActive: true },
        sort: { views: -1, soldCount: -1, rating: -1 },
        page,
        limit,
    });
};

export const getProductDetailBySlug = async (slug) => {
    const product = await Product.findOneAndUpdate(
        { slug, isActive: true },
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
        slug: { $ne: slug },
        category: product.category,
    })
        .sort({ soldCount: -1, rating: -1 })
        .limit(RELATED_PRODUCTS_LIMIT)
        .select(PRODUCT_SELECT_FIELDS)
        .lean();

    return {
        product: mapProduct(product),
        related: relatedProducts.map(mapProduct),
    };
};