import express from 'express';
import * as reviewController from '../controllers/review.controller.js';
import { authenticateToken } from '../middleware/loginMiddleware.js';
import { createReviewValidator } from '../middleware/review.middleware.js';

const router = express.Router();

const initReviewRoutes = (app) => {
    router.get('/api/reviews/products/:slug', reviewController.getProductReviewsController);
    router.post('/api/reviews', authenticateToken, createReviewValidator, reviewController.createProductReviewController);

    return app.use('/', router);
};

export default initReviewRoutes;