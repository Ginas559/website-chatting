/**
 * Script Seed Data - Tạo dữ liệu mẫu vào MongoDB
 * Database: btvn01_mongodb
 * 
 * Tạo 2 user mẫu:
 * 1. Admin: admin@chatapp.com / Admin@123 (roleId: R1)
 * 2. User:  user@chatapp.com  / User@123  (roleId: R2)
 * 
 * Password được hash bằng bcryptjs trước khi lưu vào DB.
 * 
 * Chạy: npx babel-node src/seedData.js
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/user';

require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/btvn01_mongodb';

const seedUsers = [
    {
        email: 'admin@chatapp.com',
        password: 'Admin@123',
        firstName: 'Admin',
        lastName: 'System',
        address: 'Hồ Chí Minh',
        phoneNumber: '0901234567',
        gender: true,
        roleId: 'R1',      // Admin
        positionId: 'P0',
        isActive: true
    },
    {
        email: 'user@chatapp.com',
        password: 'User@123',
        firstName: 'Nguyễn Văn',
        lastName: 'A',
        address: 'Hà Nội',
        phoneNumber: '0909876543',
        gender: true,
        roleId: 'R2',      // User
        positionId: 'P1',
        isActive: true
    },
    {
        email: 'khang@chatapp.com',
        password: 'Khang@123',
        firstName: 'Vũ Minh',
        lastName: 'Khang',
        address: 'TP. Hồ Chí Minh',
        phoneNumber: '0912345678',
        gender: true,
        roleId: 'R2',      // User
        positionId: 'P1',
        isActive: true
    },
    {
        email: 'inactive@chatapp.com',
        password: 'Inactive@123',
        firstName: 'Tài khoản',
        lastName: 'Chưa kích hoạt',
        address: 'Đà Nẵng',
        phoneNumber: '0933333333',
        gender: false,
        roleId: 'R2',
        positionId: 'P1',
        isActive: false     // Chưa kích hoạt - để test case inactive
    }
];

const seedData = async () => {
    try {
        console.log('🔌 Đang kết nối MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Kết nối MongoDB thành công!');
        console.log(`📦 Database: ${MONGO_URI}`);

        // Xóa dữ liệu cũ (nếu có)
        await User.deleteMany({});
        console.log('🗑️  Đã xóa dữ liệu user cũ');

        // Hash password và tạo user
        const salt = await bcrypt.genSalt(10);

        for (let userData of seedUsers) {
            const hashedPassword = await bcrypt.hash(userData.password, salt);
            
            const user = new User({
                email: userData.email,
                password: hashedPassword,
                firstName: userData.firstName,
                lastName: userData.lastName,
                address: userData.address,
                phoneNumber: userData.phoneNumber,
                gender: userData.gender,
                roleId: userData.roleId,
                positionId: userData.positionId,
                isActive: userData.isActive
            });

            await user.save();
            console.log(`✅ Đã tạo ${userData.roleId === 'R1' ? 'ADMIN' : 'USER'}: ${userData.email} | Password gốc: ${userData.password} | isActive: ${userData.isActive}`);
        }

        console.log('\n========================================');
        console.log('🎉 SEED DATA THÀNH CÔNG!');
        console.log('========================================');
        console.log('\n📋 THÔNG TIN ĐĂNG NHẬP THỬ:');
        console.log('┌──────────────────────────────────────┐');
        console.log('│ ADMIN:                               │');
        console.log('│   Email:    admin@chatapp.com        │');
        console.log('│   Password: Admin@123                │');
        console.log('│   Role:     R1 (Admin)               │');
        console.log('├──────────────────────────────────────┤');
        console.log('│ USER:                                │');
        console.log('│   Email:    user@chatapp.com         │');
        console.log('│   Password: User@123                 │');
        console.log('│   Role:     R2 (User)                │');
        console.log('├──────────────────────────────────────┤');
        console.log('│ KHANG:                               │');
        console.log('│   Email:    khang@chatapp.com        │');
        console.log('│   Password: Khang@123                │');
        console.log('│   Role:     R2 (User)                │');
        console.log('├──────────────────────────────────────┤');
        console.log('│ INACTIVE (test):                     │');
        console.log('│   Email:    inactive@chatapp.com     │');
        console.log('│   Password: Inactive@123             │');
        console.log('│   isActive: false (chưa kích hoạt)   │');
        console.log('└──────────────────────────────────────┘');

        await mongoose.connection.close();
        console.log('\n🔌 Đã đóng kết nối MongoDB');
        process.exit(0);

    } catch (error) {
        console.error('❌ Lỗi seed data:', error);
        process.exit(1);
    }
};

seedData();
