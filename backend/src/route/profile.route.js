/**
 * Profile Routes - Edit Profile Feature
 * Tầng Routing cho chức năng Edit Profile
 */

const express = require('express');
const router = express.Router();
const ProfileController = require('../controllers/profile.controller.js');
const { authenticateToken } = require('../middleware/auth.middleware.js');
const { editProfileLimiter } = require('../middleware/rateLimit.middleware.js');

/**
 * GET /api/profile/:id
 * Lấy thông tin profile của user
 */
router.get(
  '/:id',
  authenticateToken,
  ProfileController.getProfile
);

/**
 * PUT /api/profile/:id
 * Cập nhật thông tin profile của user
 */
router.put(
  '/:id',
  authenticateToken,
  editProfileLimiter,
  ProfileController.editProfile
);

/**
 * PATCH /api/profile/:id
 * Cập nhật một phần thông tin profile của user
 */
router.patch(
  '/:id',
  authenticateToken,
  editProfileLimiter,
  ProfileController.editProfile
);

module.exports = router;
