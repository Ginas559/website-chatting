import express from 'express';
import * as loyaltyController from '../controllers/loyalty.controller.js';
import { authenticateToken, authorizeUser } from '../middleware/loginMiddleware.js';

const router = express.Router();

const initLoyaltyRoutes = (app) => {
    router.get('/api/loyalty/me', authenticateToken, authorizeUser, loyaltyController.getMyLoyaltyController);

    return app.use('/', router);
};

export default initLoyaltyRoutes;
