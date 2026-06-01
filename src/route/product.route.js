import express from 'express';
import * as productController from '../controllers/product.controller.js';
import { authenticateToken, authorizeUser } from '../middleware/loginMiddleware.js';

const router = express.Router();

const initProductRoutes = (app) => {
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