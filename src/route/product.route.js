import express from 'express';
import * as productController from '../controllers/product.controller.js';

const router = express.Router();

const initProductRoutes = (app) => {
    router.get('/api/products/home', productController.getHomeProducts);
    router.get('/api/products/best-seller', productController.getBestSellerProductsController);
    router.get('/api/products/most-viewed', productController.getMostViewedProductsController);
    router.get('/api/products/categories', productController.getProductCategoriesController);
    router.get('/api/products', productController.searchProducts);
    router.get('/api/products/:slug', productController.getProductDetail);

    return app.use('/', router);
};

export default initProductRoutes;