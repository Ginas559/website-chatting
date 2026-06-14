import { validationResult } from 'express-validator';
import userManagementService from '../services/userManagementService.js';

const handleValidation = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({
            errCode: -1,
            errMessage: 'Dữ liệu không hợp lệ',
            errors: errors.array()
        });
        return false;
    }
    return true;
};

let listUsers = async (req, res) => {
    try {
        const result = await userManagementService.listUsers(req.user);
        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi lấy danh sách người dùng'
        });
    }
};

let createUser = async (req, res) => {
    if (!handleValidation(req, res)) return;

    try {
        const result = await userManagementService.createUser(req.body, req.user);

        if (result.errCode !== 0) {
            return res.status(result.errCode === 3 ? 403 : 400).json(result);
        }

        return res.status(201).json(result);
    } catch (error) {
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi tạo người dùng'
        });
    }
};

let updateUser = async (req, res) => {
    if (!handleValidation(req, res)) return;

    try {
        const { id } = req.params;
        const result = await userManagementService.updateUser(id, req.body, req.user);

        if (result.errCode !== 0) {
            return res.status(result.errCode === 3 ? 403 : 400).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi cập nhật người dùng'
        });
    }
};

let deleteUser = async (req, res) => {
    if (!handleValidation(req, res)) return;

    try {
        const { id } = req.params;

        if (String(req.user.id) === String(id)) {
            return res.status(400).json({
                errCode: 3,
                errMessage: 'Không thể xóa tài khoản đang đăng nhập'
            });
        }

        const result = await userManagementService.deleteUser(id, req.user);

        if (result.errCode !== 0) {
            return res.status(result.errCode === 3 ? 403 : 404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi xóa người dùng'
        });
    }
};

let resetUserPassword = async (req, res) => {
    if (!handleValidation(req, res)) return;

    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        const result = await userManagementService.resetUserPassword(id, newPassword, req.user);

        if (result.errCode !== 0) {
            return res.status(result.errCode === 3 ? 403 : 404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi reset mật khẩu người dùng'
        });
    }
};

module.exports = {
    listUsers,
    createUser,
    updateUser,
    deleteUser,
    resetUserPassword
};
