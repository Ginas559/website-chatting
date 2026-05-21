import {
    getHomeSections,
    getProductCategories,
    getProductsSearchService,
    getProductDetailBySlug,
    getBestSellerProducts,
    getMostViewedProducts,
} from '../services/product.service';

const sendSuccessResponse = (res, { message, data, pagination, status = 200 }) => {
    return res.status(status).json({
        success: true,
        errCode: 0,
        errMessage: message,
        data,
        ...(pagination ? { pagination } : {}),
    });
};

const sendErrorResponse = (res, { status, message, logLabel, error }) => {
    console.error(logLabel, error);

    return res.status(status).json({
        success: false,
        errCode: status === 404 ? 1 : -1,
        errMessage: message,
    });
};

export const getHomeProducts = async (req, res) => {
    try {
        const sections = await getHomeSections({
            limit: req.query?.limit,
            promotionPage: req.query?.promotionPage,
            latestPage: req.query?.latestPage,
            bestsellerPage: req.query?.bestsellerPage,
            mostViewedPage: req.query?.mostViewedPage,
        });

        return sendSuccessResponse(res, {
            message: 'Lấy dữ liệu trang chủ thành công',
            data: sections,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: 500,
            message: 'Lỗi server khi lấy dữ liệu sản phẩm trang chủ',
            logLabel: 'Product Controller Error:',
            error,
        });
    }
};

export const getBestSellerProductsController = async (req, res) => {
    try {
        const result = await getBestSellerProducts({
            page: req.query?.page,
            limit: req.query?.limit,
        });

        return sendSuccessResponse(res, {
            message: 'Lấy danh sách bestseller thành công',
            data: result.items,
            pagination: result.pagination,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: 500,
            message: 'Lỗi server khi lấy danh sách bestseller',
            logLabel: 'Best Seller Controller Error:',
            error,
        });
    }
};

export const getMostViewedProductsController = async (req, res) => {
    try {
        const result = await getMostViewedProducts({
            page: req.query?.page,
            limit: req.query?.limit,
        });

        return sendSuccessResponse(res, {
            message: 'Lấy danh sách sản phẩm xem nhiều thành công',
            data: result.items,
            pagination: result.pagination,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: 500,
            message: 'Lỗi server khi lấy danh sách sản phẩm xem nhiều',
            logLabel: 'Most Viewed Controller Error:',
            error,
        });
    }
};

export const getProductDetail = async (req, res) => {
    try {
        const { slug } = req.params;

        if (!slug || !String(slug).trim()) {
            return res.status(400).json({
                success: false,
                errCode: -1,
                errMessage: 'Slug sản phẩm không hợp lệ',
            });
        }

        const data = await getProductDetailBySlug(slug);

        if (!data) {
            return res.status(404).json({
                success: false,
                errCode: 1,
                errMessage: 'Không tìm thấy sản phẩm',
            });
        }

        return sendSuccessResponse(res, {
            message: 'Lấy chi tiết sản phẩm thành công',
            data,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: 500,
            message: 'Lỗi server khi lấy chi tiết sản phẩm',
            logLabel: 'Product Detail Controller Error:',
            error,
        });
    }
};

export const getProductCategoriesController = async (req, res) => {
    try {
        const categories = await getProductCategories();

        return sendSuccessResponse(res, {
            message: 'Lấy danh mục thành công',
            data: categories,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: 500,
            message: 'Lỗi server khi lấy danh mục sản phẩm',
            logLabel: 'Product Categories Controller Error:',
            error,
        });
    }
};

export const searchProducts = async (req, res) => {
    try {
        const result = await getProductsSearchService(req.query || {});

        return sendSuccessResponse(res, {
            message: 'Lấy danh sách sản phẩm thành công',
            data: result,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: 500,
            message: 'Lỗi server khi tìm kiếm sản phẩm',
            logLabel: 'Product Search Controller Error:',
            error,
        });
    }
};