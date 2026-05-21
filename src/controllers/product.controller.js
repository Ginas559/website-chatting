import {
    getHomeSections,
    getProductCategories,
    getProductsSearchService,
    getProductDetailBySlug,
} from '../services/product.service';

export const getHomeProducts = async (req, res) => {
    try {
        const limit = Number(req.query.limit) || 8;
        const safeLimit = Math.min(Math.max(limit, 1), 20);

        const sections = await getHomeSections(safeLimit);

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
        const products = await getProductsSearchService(req.query || {});

        return res.status(200).json({
            errCode: 0,
            errMessage: 'Lấy danh sách sản phẩm thành công',
            data: products,
        });
    } catch (error) {
        console.error('Product Search Controller Error:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi tìm kiếm sản phẩm',
        });
    }
};