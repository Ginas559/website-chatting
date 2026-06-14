import express from 'express';
import * as livestreamController from '../controllers/livestream.controller';
import { authenticateToken, authorizeAdmin, authorizeUser } from '../middleware/loginMiddleware';
import { endLivestreamValidator, startLivestreamValidator } from '../middleware/livestream.middleware';

const router = express.Router();

const initLivestreamRoutes = (app) => {
    router.get(
        '/api/livestream/current',
        authenticateToken,
        authorizeUser,
        livestreamController.getCurrentLivestreamController
    );

    router.post(
        '/api/admin/livestream/start',
        authenticateToken,
        authorizeAdmin,
        startLivestreamValidator,
        livestreamController.startLivestreamController
    );

    router.patch(
        '/api/admin/livestream/:id/end',
        authenticateToken,
        authorizeAdmin,
        endLivestreamValidator,
        livestreamController.endLivestreamController
    );

    router.get(
        '/api/admin/livestream/history',
        authenticateToken,
        authorizeAdmin,
        livestreamController.getLivestreamHistoryController
    );

    return app.use('/', router);
};

export default initLivestreamRoutes;
