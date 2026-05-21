import express from "express";
import * as authController from "../controllers/auth.controller.js";
import * as articleController from '../controllers/article.controller';
import loginController from "../controllers/loginController";
import { 
    registerLimiter, 
    registerValidator, 
    forgotPasswordLimiter, 
    forgotPasswordValidator, 
    resetPasswordValidator 
} from "../middleware/auth.middleware.js";
import { 
    loginLimiter, 
    loginValidator, 
    refreshTokenLimiter,
    authenticateToken, 
    authorizeUser, 
    authorizeAdmin,
    authorizeModerator,
    authorizeRoles 
} from "../middleware/loginMiddleware";
import userManagementController from "../controllers/userManagement.controller.js";
import { createUserValidator, updateUserValidator, deleteUserValidator } from "../middleware/userManagement.middleware.js";
import initProductRoutes from "./product.route.js";

let router = express.Router();

let initWebRoutes = (app) => {
    router.get('/', (req, res) => {
        return res.json({ message: 'Backend API is running' });
    });

    router.post('/api/register', registerLimiter, registerValidator, authController.registerRequest);
    router.post('/api/verify-otp', authController.verifyOTP);
    router.post('/api/forgot-password', forgotPasswordLimiter, forgotPasswordValidator, authController.forgotPasswordRequest);
    router.post('/api/reset-password', resetPasswordValidator, authController.resetPassword);

    router.post('/api/login', loginLimiter, loginValidator, loginController.handleLogin);
    router.post('/api/refresh-token', refreshTokenLimiter, loginController.handleRefreshToken);
    router.post('/api/logout', loginController.handleLogout);

    initProductRoutes(app);

    router.get('/api/articles/home', articleController.getHomeArticles);
    router.get('/api/articles/:slug', articleController.getArticleDetail);

    router.get('/user/profile', authenticateToken, authorizeUser, loginController.getUserProfile);
    router.get('/admin/profile', authenticateToken, authorizeAdmin, loginController.getAdminProfile);
    router.get('/moderator/profile', authenticateToken, authorizeModerator, loginController.getModeratorProfile);

    router.get('/admin/users', authenticateToken, authorizeRoles('R1', 'R3'), userManagementController.listUsers);
    router.post('/admin/users', authenticateToken, authorizeAdmin, createUserValidator, userManagementController.createUser);
    router.put('/admin/users/:id', authenticateToken, authorizeAdmin, updateUserValidator, userManagementController.updateUser);
    router.delete('/admin/users/:id', authenticateToken, authorizeAdmin, deleteUserValidator, userManagementController.deleteUser);

    return app.use("/", router);
}

export default initWebRoutes;