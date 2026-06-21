import express from 'express';
import * as livestreamController from '../controllers/livestream.controller';
import * as liveChatController from '../controllers/liveChat.controller';
import * as liveChatModerationController from '../controllers/liveChatModeration.controller';
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

    router.get(
        '/api/live-chat/moderation/my-bans',
        authenticateToken,
        authorizeRoles('R1', 'R2', 'R3', 'R4'),
        liveChatModerationController.myBansController
    );

    router.post(
        '/api/live-chat/moderation/bans/:caseId/unban-request',
        authenticateToken,
        authorizeRoles('R1', 'R2', 'R3', 'R4'),
        liveChatModerationController.createUnbanRequestController
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

    router.get(
        '/api/admin/live-chat/moderation/bans',
        authenticateToken,
        authorizeRoles('R1', 'R3'),
        liveChatModerationController.listBansController
    );

    router.patch(
        '/api/admin/live-chat/moderation/bans/:caseId/unban',
        authenticateToken,
        authorizeRoles('R1', 'R3'),
        liveChatModerationController.unbanController
    );

    router.get(
        '/api/admin/live-chat/moderation/unban-requests',
        authenticateToken,
        authorizeRoles('R1', 'R3'),
        liveChatModerationController.listUnbanRequestsController
    );

    router.patch(
        '/api/admin/live-chat/moderation/unban-requests/:requestId/review',
        authenticateToken,
        authorizeRoles('R1', 'R3'),
        liveChatModerationController.reviewUnbanRequestController
    );

    return app.use('/', router);
};

export default initLivestreamRoutes;
