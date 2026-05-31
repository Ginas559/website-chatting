import express from 'express';
import * as paymentController from '../controllers/payment.controller.js';

const router = express.Router();

const initPaymentRoutes = (app) => {
    router.get('/api/payments/vnpay-ipn', paymentController.vnpayIpnController);
    router.get('/api/payments/vnpay-return', paymentController.vnpayReturnController);

    return app.use('/', router);
};

export default initPaymentRoutes;
