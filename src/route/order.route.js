import express from 'express';
import * as orderController from '../controllers/order.controller.js';
import { authenticateToken, authorizeUser } from '../middleware/loginMiddleware.js';

const router = express.Router();

const initOrderRoutes = (app) => {
    router.get('/api/orders/my', authenticateToken, authorizeUser, orderController.getMyOrdersController);
    router.get('/api/orders/my/:orderIdOrCode', authenticateToken, authorizeUser, orderController.getMyOrderDetailController);
    router.patch('/api/orders/my/:orderIdOrCode/cancel', authenticateToken, authorizeUser, orderController.cancelMyOrderController);
    router.post('/api/orders/my/:orderIdOrCode/pay', authenticateToken, authorizeUser, orderController.repayVnpayOrderController);
    router.post('/api/orders/checkout', authenticateToken, authorizeUser, orderController.checkoutOrderController);

    return app.use('/', router);
};

export default initOrderRoutes;
