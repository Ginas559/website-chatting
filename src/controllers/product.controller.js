import {
    getHomeSections,
    getProductCategories,
    getProductsSearchService,
    getProductDetailBySlug,
} from '../services/product.service';
import Product from '../models/product.model';

const PRODUCT_SELECT_FIELDS =
    'name slug brand category image images price oldPrice discount stock soldCount rating views description shortDescription isPromotion isLatest isBestSeller';

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

export const getHomeProducts = async (req, res) => {
    try {
        const limit = Number(req.query.limit) || 10;
        const safeLimit = Math.min(Math.max(limit, 1), 10);

        const sections = await getHomeSections({
            limit: safeLimit,
            promotionPage: Number(req.query.promotionPage) || 1,
            latestPage: Number(req.query.latestPage) || 1,
            bestsellerPage: Number(req.query.bestsellerPage) || 1,
            mostViewedPage: Number(req.query.mostViewedPage) || 1,
        });

        const mostViewedPage = Number(req.query.mostViewedPage) || 1;
        const mostViewedSkip = (Math.max(mostViewedPage, 1) - 1) * safeLimit;
        const [mostViewedTotal, mostViewedProducts] = await Promise.all([
            Product.countDocuments({ isActive: true }),
            Product.find({ isActive: true })
                .sort({ views: -1, soldCount: -1, rating: -1, createdAt: -1 })
                .skip(mostViewedSkip)
                .limit(safeLimit)
                .select(PRODUCT_SELECT_FIELDS)
                .lean(),
        ]);

        sections.mostViewed = {
            items: mostViewedProducts.map(mapProduct),
            total: mostViewedTotal,
            page: Math.max(mostViewedPage, 1),
            limit: safeLimit,
            totalPages: Math.max(1, Math.ceil(mostViewedTotal / safeLimit)),
            hasMore: mostViewedSkip + mostViewedProducts.length < mostViewedTotal,
        };

        return res.status(200).json({
            errCode: 0,
            errMessage: 'Lấy dữ liệu trang chủ thành công',
            data: sections,
        });
    } catch (error) {
        console.error('Product Controller Error:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi lấy dữ liệu sản phẩm trang chủ',
        });
    }
};

export const getProductDetail = async (req, res) => {
    try {
        const { slug } = req.params;
        const data = await getProductDetailBySlug(slug);

        if (!data) {
            return res.status(404).json({
                errCode: 1,
                errMessage: 'Không tìm thấy sản phẩm',
            });
        }

        return res.status(200).json({
            errCode: 0,
            errMessage: 'Lấy chi tiết sản phẩm thành công',
            data,
        });
    } catch (error) {
        console.error('Product Detail Controller Error:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi lấy chi tiết sản phẩm',
        });
    }
};

export const getProductCategoriesController = async (req, res) => {
    try {
        const categories = await getProductCategories();

        return res.status(200).json({
            errCode: 0,
            errMessage: 'Lấy danh mục thành công',
            data: categories,
        });
    } catch (error) {
        console.error('Product Categories Controller Error:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi lấy danh mục sản phẩm',
        });
    }
};

export const searchProducts = async (req, res) => {
    try {
        const result = await getProductsSearchService(req.query || {});

        return res.status(200).json({
            errCode: 0,
            errMessage: 'Lấy danh sách sản phẩm thành công',
            data: result,
        });
    } catch (error) {
        console.error('Product Search Controller Error:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi tìm kiếm sản phẩm',
        });
    }
};