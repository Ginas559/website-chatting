import bcrypt from 'bcryptjs';
import User from '../models/user.js';

const roleLabels = {
    R1: 'Admin',
    R2: 'User',
    R3: 'Manager',
    R4: 'Shipper',
};

const getManageableRoles = (actorRoleId) => {
    if (actorRoleId === 'R1') return ['R3', 'R4'];
    if (actorRoleId === 'R3') return ['R4'];
    return [];
};

const canManageRole = (actorRoleId, targetRoleId) => getManageableRoles(actorRoleId).includes(targetRoleId);

const forbidden = (message = 'Bạn không có quyền thao tác với tài khoản này') => ({
    errCode: 3,
    errMessage: message,
});

const sanitizeUser = (user) => ({
    id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    address: user.address,
    phoneNumber: user.phoneNumber,
    gender: user.gender,
    image: user.image,
    roleId: user.roleId,
    positionId: user.positionId,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
});

const listUsers = async (actor = {}) => {
    try {
        const manageableRoles = getManageableRoles(actor.roleId);
        const users = await User.find({ roleId: { $in: manageableRoles } }).sort({ createdAt: -1 }).lean();

        return {
            errCode: 0,
            errMessage: 'Lấy danh sách tài khoản nội bộ thành công',
            users: users.map((user) => sanitizeUser(user))
        };
    } catch (error) {
        console.error('List Users Service Error:', error);
        throw error;
    }
};

const createUser = async (payload, actor = {}) => {
    try {
        const email = String(payload.email || '').toLowerCase().trim();
        const roleId = payload.roleId || (actor.roleId === 'R3' ? 'R4' : 'R3');

        if (!canManageRole(actor.roleId, roleId)) {
            return forbidden(`${roleLabels[actor.roleId] || 'Tài khoản hiện tại'} không thể tạo ${roleLabels[roleId] || 'role này'}`);
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return {
                errCode: 1,
                errMessage: 'Email đã được sử dụng'
            };
        }

        const hashedPassword = await bcrypt.hash(payload.password, 10);

        const user = await User.create({
            email,
            password: hashedPassword,
            firstName: payload.firstName,
            lastName: payload.lastName,
            address: payload.address,
            phoneNumber: payload.phoneNumber,
            gender: payload.gender,
            image: payload.image,
            roleId,
            positionId: payload.positionId,
            isActive: payload.isActive ?? true
        });

        return {
            errCode: 0,
            errMessage: `Tạo tài khoản ${roleLabels[roleId]} thành công`,
            user: sanitizeUser(user)
        };
    } catch (error) {
        console.error('Create User Service Error:', error);
        throw error;
    }
};

const updateUser = async (userId, payload, actor = {}) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            return {
                errCode: 1,
                errMessage: 'Không tìm thấy người dùng'
            };
        }

        const nextRoleId = payload.roleId || user.roleId;
        if (!canManageRole(actor.roleId, user.roleId) || !canManageRole(actor.roleId, nextRoleId)) {
            return forbidden();
        }

        if (payload.email) {
            const nextEmail = String(payload.email).toLowerCase().trim();
            const duplicate = await User.findOne({ email: nextEmail, _id: { $ne: userId } });
            if (duplicate) {
                return {
                    errCode: 2,
                    errMessage: 'Email đã được sử dụng'
                };
            }
            user.email = nextEmail;
        }

        const updatableFields = ['firstName', 'lastName', 'address', 'phoneNumber', 'gender', 'image', 'roleId', 'positionId', 'isActive'];

        for (const field of updatableFields) {
            if (payload[field] !== undefined) {
                user[field] = payload[field];
            }
        }

        await user.save();

        return {
            errCode: 0,
            errMessage: 'Cập nhật tài khoản nội bộ thành công',
            user: sanitizeUser(user)
        };
    } catch (error) {
        console.error('Update User Service Error:', error);
        throw error;
    }
};

const deleteUser = async (userId, actor = {}) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            return {
                errCode: 1,
                errMessage: 'Không tìm thấy người dùng'
            };
        }

        if (!canManageRole(actor.roleId, user.roleId)) {
            return forbidden();
        }

        const deletedUser = await User.findByIdAndDelete(userId);

        return {
            errCode: 0,
            errMessage: 'Xóa tài khoản nội bộ thành công',
            user: sanitizeUser(deletedUser)
        };
    } catch (error) {
        console.error('Delete User Service Error:', error);
        throw error;
    }
};

const resetUserPassword = async (userId, newPassword, actor = {}) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            return {
                errCode: 1,
                errMessage: 'Không tìm thấy người dùng'
            };
        }

        if (!canManageRole(actor.roleId, user.roleId)) {
            return forbidden('Bạn không có quyền reset mật khẩu tài khoản này');
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        return {
            errCode: 0,
            errMessage: 'Reset mật khẩu tài khoản cấp dưới thành công',
            user: sanitizeUser(user)
        };
    } catch (error) {
        console.error('Reset User Password Service Error:', error);
        throw error;
    }
};

export default {
    listUsers,
    createUser,
    updateUser,
    deleteUser,
    resetUserPassword
};
