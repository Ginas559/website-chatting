import {
    getHomeSections,
    getProductCategories,
    getProductsSearchService,
    getProductDetailBySlug,
    getBestSellerProducts,
    getMostViewedProducts,
    toggleFavoriteProductService,
    getFavoriteProductsService,
    addRecentlyViewedProductService,
    getRecentlyViewedProductsService,
    getAdminProductsService,
    createAdminProductService,
    updateAdminProductService,
    updateAdminProductStatusService,
    softDeleteAdminProductService,
} from '../services/product.service';
import { validationResult } from 'express-validator';

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

export const getFavoriteProducts = async (req, res) => {
    try {
        const result = await getFavoriteProductsService({ userId: req.user?.id });

        if (!result) {
            return res.status(404).json({
                success: false,
                errCode: 1,
                errMessage: 'Không tìm thấy dữ liệu yêu thích',
            });
        }

        return sendSuccessResponse(res, {
            message: 'Lấy danh sách yêu thích thành công',
            data: result,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: 500,
            message: 'Lỗi server khi lấy danh sách yêu thích',
            logLabel: 'Get Favorite Products Controller Error:',
            error,
        });
    }
};

export const toggleFavoriteProduct = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const result = await toggleFavoriteProductService({
            userId: userId ? String(userId) : '',
            productId: req.params?.productId,
        });

        if (!result || result.invalid) {
            return res.status(400).json({
                success: false,
                errCode: -1,
                errMessage: 'Sản phẩm không hợp lệ hoặc không tồn tại',
            });
        }

        return sendSuccessResponse(res, {
            message: result.isFavorite ? 'Đã thêm vào yêu thích' : 'Đã bỏ khỏi yêu thích',
            data: result,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: 500,
            message: 'Lỗi server khi cập nhật yêu thích',
            logLabel: 'Toggle Favorite Product Controller Error:',
            error,
        });
    }
};

export const addRecentlyViewedProduct = async (req, res) => {
    try {
        const result = await addRecentlyViewedProductService({
            userId: req.user?.id,
            slug: req.params?.slug,
        });

        if (!result) {
            return res.status(400).json({
                success: false,
                errCode: -1,
                errMessage: 'Không thể lưu sản phẩm đã xem',
            });
        }

        return sendSuccessResponse(res, {
            message: 'Đã lưu sản phẩm đã xem',
            data: result,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: 500,
            message: 'Lỗi server khi lưu sản phẩm đã xem',
            logLabel: 'Add Recently Viewed Product Controller Error:',
            error,
        });
    }
};

export const getRecentlyViewedProducts = async (req, res) => {
    try {
        const result = await getRecentlyViewedProductsService({ userId: req.user?.id });

        if (!result) {
            return res.status(404).json({
                success: false,
                errCode: 1,
                errMessage: 'Không tìm thấy dữ liệu sản phẩm đã xem',
            });
        }

        return sendSuccessResponse(res, {
            message: 'Lấy danh sách sản phẩm đã xem thành công',
            data: result,
        });
    } catch (error) {
        return sendErrorResponse(res, {
            status: 500,
            message: 'Lỗi server khi lấy sản phẩm đã xem',
            logLabel: 'Get Recently Viewed Products Controller Error:',
            error,
        });
    }
};

const handleValidation = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ', errors: errors.array() });
        return false;
    }
    return true;
};

export const getAdminProducts = async (req, res) => {
    try {
        const data = await getAdminProductsService(req.query || {});
        return res.json({ success: true, message: 'Lấy danh sách sản phẩm thành công', data });
    } catch (error) {
        return sendErrorResponse(res, { status: 500, message: 'Lỗi server khi lấy sản phẩm quản trị', logLabel: 'Admin Product List Error:', error });
    }
};

export const createAdminProduct = async (req, res) => {
    if (!handleValidation(req, res)) return;
    try {
        const data = await createAdminProductService(req.body, req.user?.id);
        return res.status(201).json({ success: true, message: 'Tạo sản phẩm thành công', data });
    } catch (error) {
        return sendErrorResponse(res, { status: 500, message: 'Lỗi server khi tạo sản phẩm', logLabel: 'Admin Product Create Error:', error });
    }
};

export const updateAdminProduct = async (req, res) => {
    if (!handleValidation(req, res)) return;
    try {
        const data = await updateAdminProductService(req.params.id, req.body, req.user?.id);
        if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
        return res.json({ success: true, message: 'Cập nhật sản phẩm thành công', data });
    } catch (error) {
        return sendErrorResponse(res, { status: 500, message: 'Lỗi server khi cập nhật sản phẩm', logLabel: 'Admin Product Update Error:', error });
    }
};

export const updateAdminProductStatus = async (req, res) => {
    if (!handleValidation(req, res)) return;
    try {
        const data = await updateAdminProductStatusService(req.params.id, req.body.status, req.user?.id);
        if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
        return res.json({ success: true, message: 'Cập nhật trạng thái sản phẩm thành công', data });
    } catch (error) {
        return sendErrorResponse(res, { status: 500, message: 'Lỗi server khi cập nhật trạng thái sản phẩm', logLabel: 'Admin Product Status Error:', error });
    }
};

export const deleteAdminProduct = async (req, res) => {
    if (!handleValidation(req, res)) return;
    try {
        const data = await softDeleteAdminProductService(req.params.id, req.user?.id);
        if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
        return res.json({ success: true, message: 'Xóa mềm sản phẩm thành công', data });
    } catch (error) {
        return sendErrorResponse(res, { status: 500, message: 'Lỗi server khi xóa sản phẩm', logLabel: 'Admin Product Delete Error:', error });
    }
};
