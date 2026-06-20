import express from 'express';
import * as livestreamController from '../controllers/livestream.controller';
import * as liveChatController from '../controllers/liveChat.controller';
import { authenticateToken, authorizeAdmin, authorizeRoles } from '../middleware/loginMiddleware';
import { endLivestreamValidator, startLivestreamValidator } from '../middleware/livestream.middleware';

const router = express.Router();

const initLivestreamRoutes = (app) => {
    router.get(
        '/api/livestream/current',
        authenticateToken,
        authorizeRoles('R1', 'R2', 'R3', 'R4'),
        livestreamController.getCurrentLivestreamController
    );

    router.get(
        '/api/livestream/:liveId/chat/messages',
        authenticateToken,
        authorizeRoles('R1', 'R2', 'R3', 'R4'),
        liveChatController.getRecentMessagesController
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
