import express from 'express';
import * as productController from '../controllers/product.controller.js';
import { authenticateToken, authorizeUser, authorizeRoles } from '../middleware/loginMiddleware.js';
import {
    createAdminProductValidator,
    updateAdminProductStatusValidator,
    updateAdminProductValidator,
    deleteAdminProductValidator,
} from '../middleware/adminProduct.middleware.js';

const router = express.Router();

const initProductRoutes = (app) => {
    router.get('/api/admin/products', authenticateToken, authorizeRoles('R1', 'R3'), productController.getAdminProducts);
    router.post('/api/admin/products', authenticateToken, authorizeRoles('R1', 'R3'), createAdminProductValidator, productController.createAdminProduct);
    router.patch('/api/admin/products/:id', authenticateToken, authorizeRoles('R1', 'R3'), updateAdminProductValidator, productController.updateAdminProduct);
    router.patch('/api/admin/products/:id/status', authenticateToken, authorizeRoles('R1', 'R3'), updateAdminProductStatusValidator, productController.updateAdminProductStatus);
    router.delete('/api/admin/products/:id', authenticateToken, authorizeRoles('R1'), deleteAdminProductValidator, productController.deleteAdminProduct);

    router.get('/api/products/home', productController.getHomeProducts);
    router.get('/api/products/best-seller', productController.getBestSellerProductsController);
    router.get('/api/products/most-viewed', productController.getMostViewedProductsController);
    router.get('/api/products/categories', productController.getProductCategoriesController);
    router.get('/api/products/favorites', authenticateToken, authorizeUser, productController.getFavoriteProducts);
    router.post('/api/products/:productId/favorite', authenticateToken, authorizeUser, productController.toggleFavoriteProduct);
    router.get('/api/products/recently-viewed', authenticateToken, authorizeUser, productController.getRecentlyViewedProducts);
    router.post('/api/products/:slug/viewed', authenticateToken, authorizeUser, productController.addRecentlyViewedProduct);
    router.get('/api/products', productController.searchProducts);
    router.get('/api/products/:slug', productController.getProductDetail);

    return app.use('/', router);
};

export default initProductRoutes;
