import express from 'express';
import { authenticateToken } from '../middleware/loginMiddleware';
import * as notificationController from '../controllers/notification.controller';

const router = express.Router();

const initNotificationRoutes = (app) => {
    router.get('/api/notifications', authenticateToken, notificationController.getMyNotifications);
    router.patch('/api/notifications/read-all', authenticateToken, notificationController.markAllAsRead);
    router.patch('/api/notifications/:id/read', authenticateToken, notificationController.markAsRead);

    return app.use('/', router);
};

export default initNotificationRoutes;
