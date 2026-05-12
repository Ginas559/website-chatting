/**
 * User Controller - Tầng Presentation Logic
 * Xử lý requests từ routes
 */

const UserService = require('../services/userService');
const ResponseHandler = require('../utils/responseHandler');
const { validateEditProfile } = require('../validators/editProfileValidator');

class UserController {
  /**
   * GET /api/users/:id
   * Lấy thông tin profile của user
   */
  static async getProfile(req, res) {
    try {
      const userId = req.params.id;

      // Kiểm tra user có quyền lấy thông tin của chính mình không
      if (req.user.id != userId) {
        return ResponseHandler.error(
          res,
          'Unauthorized to view this profile',
          null,
          403
        );
      }

      const user = await UserService.getUserById(userId);

      return ResponseHandler.success(
        res,
        user,
        'User profile retrieved successfully'
      );
    } catch (error) {
      return ResponseHandler.error(
        res,
        error.message || 'Failed to get user profile',
        error,
        error.statusCode || 500
      );
    }
  }

  /**
   * PUT or PATCH /api/users/:id/profile
   * Cập nhật thông tin profile của user
   */
  static async editProfile(req, res) {
    try {
      const userId = req.params.id;
      const updateData = req.body;

      // Kiểm tra user có quyền cập nhật chính mình không
      if (req.user.id != userId) {
        return ResponseHandler.error(
          res,
          'Unauthorized to edit this profile',
          null,
          403
        );
      }

      // Input Validation
      const { error, value } = validateEditProfile(updateData);

      if (error) {
        const errors = error.details.map((detail) => ({
          field: detail.context.label || detail.path.join('.'),
          message: detail.message,
        }));

        return ResponseHandler.validationError(res, errors);
      }

      // Gọi service để cập nhật profile
      const updatedUser = await UserService.updateUserProfile(userId, value);

      return ResponseHandler.success(
        res,
        updatedUser,
        'User profile updated successfully',
        200
      );
    } catch (error) {
      return ResponseHandler.error(
        res,
        error.message || 'Failed to update user profile',
        error,
        error.statusCode || 500
      );
    }
  }
}

module.exports = UserController;
