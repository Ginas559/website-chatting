import express from 'express';
import * as cartController from '../controllers/cart.controller.js';
import { authenticateToken } from '../middleware/loginMiddleware.js';

const router = express.Router();

const initCartRoutes = (app) => {
    router.get('/api/cart', authenticateToken, cartController.getCurrentCartController);
    router.post('/api/cart/items', authenticateToken, cartController.addToCartController);
    router.patch('/api/cart/items/:productId', authenticateToken, cartController.updateCartItemQuantityController);
    router.delete('/api/cart/items/:productId', authenticateToken, cartController.removeFromCartController);
    router.delete('/api/cart', authenticateToken, cartController.clearCartController);

    return app.use('/', router);
};

export default initCartRoutes;