import express from "express";
import * as authController from "../controllers/auth.controller.js";
import * as articleController from '../controllers/article.controller';
import * as dashboardController from '../controllers/dashboard.controller';
import * as settingController from '../controllers/setting.controller';
import loginController from "../controllers/loginController";
import { 
    registerLimiter, 
    registerValidator, 
    forgotPasswordLimiter, 
    forgotPasswordValidator, 
    resetPasswordValidator,
    changePasswordValidator 
} from "../middleware/auth.middleware.js";
import { 
    loginLimiter, 
    loginValidator, 
    refreshTokenLimiter,
    authenticateToken, 
    authorizeUser, 
    authorizeAdmin,
    authorizeManager,
    authorizeShipper,
    authorizeRoles 
} from "../middleware/loginMiddleware";
import userManagementController from "../controllers/userManagement.controller.js";
import * as voucherController from "../controllers/voucher.controller.js";
import { createUserValidator, updateUserValidator, deleteUserValidator, resetUserPasswordValidator } from "../middleware/userManagement.middleware.js";
import { updateSettingsValidator } from "../middleware/setting.middleware.js";
import initProductRoutes from "./product.route.js";
import initCartRoutes from "./cart.route.js";
import initOrderRoutes from "./order.route.js";
import initPaymentRoutes from "./payment.route.js";
import initReviewRoutes from "./review.route.js";
import initNotificationRoutes from "./notification.route.js";
import initLivestreamRoutes from "./livestream.route.js";
import initLoyaltyRoutes from "./loyalty.route.js";
import initChatRoutes from "./chat.route.js";

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
    router.patch('/api/me/password', authenticateToken, changePasswordValidator, loginController.changePassword);

    router.get('/api/admin/dashboard/overview', authenticateToken, authorizeRoles('R1', 'R3'), dashboardController.getOverviewController);
    router.get('/api/admin/dashboard/revenue', authenticateToken, authorizeRoles('R1', 'R3'), dashboardController.getRevenueController);
    router.get('/api/admin/dashboard/order-status', authenticateToken, authorizeRoles('R1', 'R3'), dashboardController.getOrderStatusController);
    router.get('/api/admin/dashboard/top-products', authenticateToken, authorizeRoles('R1', 'R3'), dashboardController.getTopProductsController);
    router.get('/api/admin/dashboard/recent-orders', authenticateToken, authorizeRoles('R1', 'R3'), dashboardController.getRecentOrdersController);
    router.get('/api/admin/dashboard/new-customers', authenticateToken, authorizeRoles('R1', 'R3'), dashboardController.getNewCustomersController);
    router.get('/api/admin/dashboard/cashflow', authenticateToken, authorizeRoles('R1', 'R3'), dashboardController.getCashflowController);

    router.get('/api/admin/settings', authenticateToken, authorizeRoles('R1', 'R3'), settingController.getSettingsController);
    router.patch('/api/admin/settings', authenticateToken, authorizeAdmin, updateSettingsValidator, settingController.updateSettingsController);

    initProductRoutes(app);

    router.get('/api/articles/home', articleController.getHomeArticles);
    router.get('/api/articles/:slug', articleController.getArticleDetail);
    router.post('/api/admin/articles', authenticateToken, authorizeAdmin, articleController.createArticleController);

    router.get('/user/profile', authenticateToken, authorizeUser, loginController.getUserProfile);
    router.get('/admin/profile', authenticateToken, authorizeAdmin, loginController.getAdminProfile);
    router.get('/manager/profile', authenticateToken, authorizeManager, loginController.getManagerProfile);
    router.get('/shipper/profile', authenticateToken, authorizeShipper, loginController.getShipperProfile);

    initCartRoutes(app);
    initOrderRoutes(app);
    initPaymentRoutes(app);
    initReviewRoutes(app);
    initNotificationRoutes(app);
    initLivestreamRoutes(app);
    initLoyaltyRoutes(app);
    initChatRoutes(app);

    router.get('/admin/users', authenticateToken, authorizeRoles('R1', 'R3'), userManagementController.listUsers);
    router.post('/admin/users', authenticateToken, authorizeRoles('R1', 'R3'), createUserValidator, userManagementController.createUser);
    router.put('/admin/users/:id', authenticateToken, authorizeRoles('R1', 'R3'), updateUserValidator, userManagementController.updateUser);
    router.patch('/admin/users/:id/reset-password', authenticateToken, authorizeRoles('R1', 'R3'), resetUserPasswordValidator, userManagementController.resetUserPassword);
    router.delete('/admin/users/:id', authenticateToken, authorizeRoles('R1', 'R3'), deleteUserValidator, userManagementController.deleteUser);

    router.post('/api/admin/vouchers', authenticateToken, authorizeRoles('R1', 'R3'), voucherController.createVoucherController);
    router.get('/api/admin/vouchers', authenticateToken, authorizeRoles('R1', 'R3'), voucherController.getVouchersAdminController);
    router.get('/api/admin/vouchers/:id', authenticateToken, authorizeRoles('R1', 'R3'), voucherController.getVoucherByIdController);
    router.put('/api/admin/vouchers/:id', authenticateToken, authorizeRoles('R1', 'R3'), voucherController.updateVoucherController);
    router.delete('/api/admin/vouchers/:id', authenticateToken, authorizeRoles('R1', 'R3'), voucherController.deleteVoucherController);

    router.get('/api/vouchers/my', authenticateToken, authorizeUser, voucherController.getAvailableVouchersController);

    return app.use("/", router);
}

export default initWebRoutes;
