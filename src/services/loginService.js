import bcrypt from 'bcryptjs';
import User from '../models/user';
import RefreshToken from '../models/refreshToken.model';
import { createAccessToken, createRefreshToken, verifyRefreshToken } from '../utils/jwt';

/**
 * Service Layer - Xử lý logic nghiệp vụ cho Login
 * Kiến trúc 3 tầng: Controller -> Service -> Model
 */

// Xử lý đăng nhập
let handleUserLogin = async (email, password) => {
    try {
        // Tìm user theo email
        let user = await User.findOne({ email: email.toLowerCase().trim() });
        
        if (!user) {
            return {
                errCode: 1,
                errMessage: 'Email không tồn tại trong hệ thống'
            };
        }

        // Kiểm tra tài khoản đã kích hoạt chưa
        if (!user.isActive) {
            return {
                errCode: 4,
                errMessage: 'Tài khoản chưa được kích hoạt. Vui lòng xác nhận OTP qua email.'
            };
        }

        // So sánh password đã hash
        let isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return {
                errCode: 2,
                errMessage: 'Mật khẩu không chính xác'
            };
        }

        // Tạo Access Token (ngắn hạn - 15 phút)
        let accessToken = createAccessToken(user);
        
        // Tạo Refresh Token (dài hạn - 7 ngày)
        let refreshToken = createRefreshToken(user);

        // Lưu refresh token vào database
        let expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 ngày

        await RefreshToken.create({
            token: refreshToken,
            userId: user._id,
            expiresAt: expiresAt
        });

        // Trả về thông tin user (không bao gồm password)
        let userInfo = {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            roleId: user.roleId,
            address: user.address,
            phoneNumber: user.phoneNumber,
            gender: user.gender,
            image: user.image
        };

        return {
            errCode: 0,
            errMessage: 'Đăng nhập thành công',
            user: userInfo,
            accessToken: accessToken,
            refreshToken: refreshToken
        };

    } catch (error) {
        console.error('Login Service Error:', error);
        throw error;
    }
};

// Xử lý Refresh Token - cấp lại Access Token mới
let handleRefreshToken = async (refreshTokenValue) => {
    try {
        if (!refreshTokenValue) {
            return {
                errCode: 1,
                errMessage: 'Refresh token không được cung cấp'
            };
        }

        // Kiểm tra refresh token có tồn tại trong DB không
        let storedToken = await RefreshToken.findOne({ token: refreshTokenValue });
        if (!storedToken) {
            return {
                errCode: 2,
                errMessage: 'Refresh token không hợp lệ hoặc đã bị thu hồi'
            };
        }

        // Kiểm tra token đã hết hạn chưa
        if (storedToken.expiresAt < new Date()) {
            await RefreshToken.deleteOne({ _id: storedToken._id });
            return {
                errCode: 3,
                errMessage: 'Refresh token đã hết hạn, vui lòng đăng nhập lại'
            };
        }

        // Verify JWT signature
        let decoded = verifyRefreshToken(refreshTokenValue);
        if (!decoded) {
            await RefreshToken.deleteOne({ _id: storedToken._id });
            return {
                errCode: 4,
                errMessage: 'Refresh token không hợp lệ'
            };
        }

        // Tìm user
        let user = await User.findById(decoded.id);
        if (!user) {
            await RefreshToken.deleteOne({ _id: storedToken._id });
            return {
                errCode: 5,
                errMessage: 'Người dùng không tồn tại'
            };
        }

        // Xóa refresh token cũ (Rotation strategy)
        await RefreshToken.deleteOne({ _id: storedToken._id });

        // Tạo token mới
        let newAccessToken = createAccessToken(user);
        let newRefreshToken = createRefreshToken(user);

        // Lưu refresh token mới
        let expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await RefreshToken.create({
            token: newRefreshToken,
            userId: user._id,
            expiresAt: expiresAt
        });

        return {
            errCode: 0,
            errMessage: 'Cấp token mới thành công',
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        };

    } catch (error) {
        console.error('Refresh Token Service Error:', error);
        throw error;
    }
};

// Xử lý đăng xuất - xóa refresh token
let handleLogout = async (refreshTokenValue) => {
    try {
        if (refreshTokenValue) {
            await RefreshToken.deleteOne({ token: refreshTokenValue });
        }
        return {
            errCode: 0,
            errMessage: 'Đăng xuất thành công'
        };
    } catch (error) {
        console.error('Logout Service Error:', error);
        throw error;
    }
};

// Lấy thông tin profile theo userId
let getUserProfile = async (userId) => {
    try {
        let user = await User.findById(userId).select('-password').lean();
        if (!user) {
            return {
                errCode: 1,
                errMessage: 'Không tìm thấy người dùng'
            };
        }
        return {
            errCode: 0,
            errMessage: 'OK',
            user: user
        };
    } catch (error) {
        console.error('Get Profile Service Error:', error);
        throw error;
    }
};

module.exports = {
    handleUserLogin,
    handleRefreshToken,
    handleLogout,
    getUserProfile
};
