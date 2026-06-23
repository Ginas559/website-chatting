import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/loginMiddleware';
import * as chatController from '../controllers/chat.controller.js';

const router = express.Router();

const initChatRoutes = (app) => {
    router.post('/api/chat/send', authenticateToken, chatController.sendMessage);
    router.get('/api/chat/support', authenticateToken, chatController.getSupportUser);
    router.get('/api/chat/users', authenticateToken, chatController.getChatUsers);
    router.get('/api/chat/users/:id', authenticateToken, chatController.getChatUserById);
    router.get('/api/chat/history/:senderId/:receiverId', authenticateToken, chatController.getHistory);
    router.patch('/api/chat/read/:senderId', authenticateToken, chatController.markAsRead);
    router.get('/api/chat/contacts', authenticateToken, chatController.getChatContacts);

    return app.use('/', router);
};

export default initChatRoutes;
