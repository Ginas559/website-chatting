import express from 'express';
import * as orderController from '../controllers/order.controller.js';
import { authenticateToken, authorizeAdmin, authorizeUser } from '../middleware/loginMiddleware.js';

const router = express.Router();

const initOrderRoutes = (app) => {
    router.get('/api/admin/orders', authenticateToken, authorizeAdmin, orderController.getAdminOrdersController);
    router.get('/api/admin/orders/:orderIdOrCode', authenticateToken, authorizeAdmin, orderController.getAdminOrderDetailController);
    router.patch('/api/admin/orders/:orderIdOrCode/status', authenticateToken, authorizeAdmin, orderController.updateAdminOrderStatusController);
    router.patch('/api/admin/orders/:orderIdOrCode/cancel-request', authenticateToken, authorizeAdmin, orderController.resolveAdminCancelRequestController);

    router.get('/api/orders/my', authenticateToken, authorizeUser, orderController.getMyOrdersController);
    router.get('/api/orders/my/:orderIdOrCode', authenticateToken, authorizeUser, orderController.getMyOrderDetailController);
    router.patch('/api/orders/my/:orderIdOrCode/cancel', authenticateToken, authorizeUser, orderController.cancelMyOrderController);
    router.post('/api/orders/my/:orderIdOrCode/pay', authenticateToken, authorizeUser, orderController.repayVnpayOrderController);
    router.post('/api/orders/checkout', authenticateToken, authorizeUser, orderController.checkoutOrderController);

    return app.use('/', router);
};

export default initOrderRoutes;
