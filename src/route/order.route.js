import express from 'express';
import * as orderController from '../controllers/order.controller.js';
import { authenticateToken, authorizeAdmin, authorizeRoles, authorizeUser } from '../middleware/loginMiddleware.js';
import { createDeliveryQrLimiter, verifyDeliveryQrLimiter } from '../middleware/deliveryVerification.middleware.js';

const router = express.Router();

const initOrderRoutes = (app) => {
    router.get('/api/admin/orders', authenticateToken, authorizeRoles('R1', 'R3'), orderController.getAdminOrdersController);
    router.get('/api/admin/orders/:orderIdOrCode', authenticateToken, authorizeRoles('R1', 'R3'), orderController.getAdminOrderDetailController);
    router.patch('/api/admin/orders/:orderIdOrCode/status', authenticateToken, authorizeRoles('R1', 'R3'), orderController.updateAdminOrderStatusController);
    router.patch('/api/admin/orders/:orderIdOrCode/cancel-request', authenticateToken, authorizeRoles('R1', 'R3'), orderController.resolveAdminCancelRequestController);
    router.get('/api/admin/orders/:orderIdOrCode/delivery-qr', authenticateToken, authorizeRoles('R1', 'R3'), orderController.getAdminDeliveryQrController);
    router.post('/api/admin/orders/:orderIdOrCode/delivery-qr', authenticateToken, authorizeRoles('R1', 'R3'), createDeliveryQrLimiter, orderController.createAdminDeliveryQrController);

    router.post('/api/orders/delivery/verify', authenticateToken, authorizeRoles('R2', 'R4', 'R1', 'R3'), verifyDeliveryQrLimiter, orderController.verifyMyDeliveryQrController);
    router.get('/api/orders/my', authenticateToken, authorizeUser, orderController.getMyOrdersController);
    router.get('/api/orders/my/:orderIdOrCode', authenticateToken, authorizeUser, orderController.getMyOrderDetailController);
    router.patch('/api/orders/my/:orderIdOrCode/cancel', authenticateToken, authorizeUser, orderController.cancelMyOrderController);
    router.post('/api/orders/my/:orderIdOrCode/pay', authenticateToken, authorizeUser, orderController.repayVnpayOrderController);
    router.post('/api/orders/checkout', authenticateToken, authorizeUser, orderController.checkoutOrderController);

    return app.use('/', router);
};

export default initOrderRoutes;
