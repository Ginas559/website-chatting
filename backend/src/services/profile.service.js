/**
 * User Service - Tầng Business Logic
 * Xử lý các logic liên quan đến user
 */

// Simulated database (thay thế bằng real database connection trong thực tế)
const usersDB = {
  1: {
    id: 1,
    email: 'user1@example.com',
    firstName: 'John',
    lastName: 'Doe',
    phone: '0123456789',
    address: '123 Main St',
    city: 'New York',
    country: 'USA',
    bio: 'A software developer',
    avatar: 'https://example.com/avatar1.jpg',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  2: {
    id: 2,
    email: 'user2@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    phone: '0987654321',
    address: '456 Oak Ave',
    city: 'Los Angeles',
    country: 'USA',
    bio: 'A product manager',
    avatar: 'https://example.com/avatar2.jpg',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
};

class UserService {
  /**
   * Lấy thông tin user theo ID
   * @param {number} userId - ID của user
   * @returns {Promise} - User object
   */
  static async getUserById(userId) {
    return new Promise((resolve, reject) => {
      try {
        const user = usersDB[userId];

        if (!user) {
          return reject({
            statusCode: 404,
            message: 'User not found',
          });
        }

        // Không trả về data nhạy cảm
        const { ...userWithoutSensitive } = user;
        resolve(userWithoutSensitive);
      } catch (error) {
        reject({
          statusCode: 500,
          message: error.message,
        });
      }
    });
  }

  /**
   * Cập nhật thông tin profile của user
   * @param {number} userId - ID của user
   * @param {object} updateData - Dữ liệu cần cập nhật
   * @returns {Promise} - Updated user object
   */
  static async updateUserProfile(userId, updateData) {
    return new Promise((resolve, reject) => {
      try {
        // Kiểm tra user có tồn tại không
        if (!usersDB[userId]) {
          return reject({
            statusCode: 404,
            message: 'User not found',
          });
        }

        // Cập nhật chỉ các trường được chỉ định
        const user = usersDB[userId];
        const updatableFields = [
          'firstName',
          'lastName',
          'phone',
          'address',
          'city',
          'country',
          'bio',
          'avatar',
        ];

        for (const field of updatableFields) {
          if (field in updateData) {
            user[field] = updateData[field];
          }
        }

        // Cập nhật timestamp
        user.updatedAt = new Date();

        // Log the update (trong thực tế: save to database)
        console.log(`Profile updated for user ${userId}:`, updateData);

        resolve({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          address: user.address,
          city: user.city,
          country: user.country,
          bio: user.bio,
          avatar: user.avatar,
          updatedAt: user.updatedAt,
        });
      } catch (error) {
        reject({
          statusCode: 500,
          message: error.message,
        });
      }
    });
  }

  /**
   * Xóa thông tin nhạy cảm từ user object
   * @param {object} user - User object
   * @returns {object} - User object without sensitive data
   */
  static sanitizeUser(user) {
    const { ...sanitized } = user;
    return sanitized;
  }
}

module.exports = UserService;
