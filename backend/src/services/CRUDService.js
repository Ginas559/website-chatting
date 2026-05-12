import bcrypt from 'bcryptjs';
import User from '../models/user.js';

const salt = bcrypt.genSaltSync(10);

export const createNewUser = async (data) => {
    return new Promise(async (resolve, reject) => {
        try {
            let hashPasswordFromBcrypt = await hashUserPassword(data.password);
            let newUser = new User({
                email: data.email,
                password: hashPasswordFromBcrypt,
                firstName: data.firstName,
                lastName: data.lastName,
                address: data.address || '', 
                phoneNumber: data.phoneNumber || '',
                gender: data.gender === '1' ? true : false,
                roleId: data.roleId || 'R2',
                isActive: true 
            });

            await newUser.save();
            resolve('OK! Tạo user thành công');
        } catch (e) {
            reject(e);
        }
    });
}

let hashUserPassword = (password) => {
    return new Promise(async (resolve, reject) => {
        try {
            let hashPassword = await bcrypt.hashSync(password, salt);
            resolve(hashPassword);
        } catch (e) {
            reject(e);
        }
    });
}

export const getAllUser = () => {
    return new Promise(async (resolve, reject) => {
        try {
            let users = await User.find().lean();
            resolve(users);
        } catch (e) {
            reject(e);
        }
    });
}

export const getUserInfoById = (userId) => {
    return new Promise(async (resolve, reject) => {
        try {
            let user = await User.findById(userId).lean();
            if (user) {
                resolve(user);
            } else {
                resolve([]);
            }
        } catch (e) {
            reject(e);
        }
    });
}

export const updateUser = (data) => {
    return new Promise(async (resolve, reject) => {
        try {
            await User.findByIdAndUpdate(data.id, {
                firstName: data.firstName,
                lastName: data.lastName,
                address: data.address
            });
            let allUsers = await User.find().lean();
            resolve(allUsers);
        } catch (e) {
            reject(e);
        }
    });
}

export const deleteUserById = (userId) => {
    return new Promise(async (resolve, reject) => {
        try {
            await User.findByIdAndDelete(userId);
            resolve();
        } catch (e) {
            reject(e);
        }
    });
}