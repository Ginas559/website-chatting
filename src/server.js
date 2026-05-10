import express from "express";
import bodyParser from "body-parser";
import viewEngine from "./config/viewEngine";
import connectDB from "./config/connectDB";
import initWebRoutes from "./route/web";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/user";

require('dotenv').config();

let app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

viewEngine(app);

connectDB();

// Auto-seed data lần đầu
const seedDataIfFirstTime = async () => {
    try {
        // Kiểm tra xem admin user đã tồn tại chưa
        const adminExists = await User.findOne({ email: 'admin@chatapp.com' });
        
        if (!adminExists) {
            console.log('🌱 Lần đầu chạy app - tạo dữ liệu mẫu...');
            
            const seedUsers = [
                {
                    email: 'admin@chatapp.com',
                    password: 'Admin@123',
                    firstName: 'Admin',
                    lastName: 'System',
                    address: 'TP. Hồ Chí Minh',
                    phoneNumber: '0901234567',
                    gender: true,
                    roleId: 'R1',
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
                    roleId: 'R2',
                    positionId: 'P1',
                    isActive: true
                }
            ];
            
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
            }
            
            console.log('✅ Tạo 2 tài khoản mẫu thành công!');
            console.log('📧 Admin: admin@chatapp.com / Admin@123');
            console.log('👤 User: user@chatapp.com / User@123');
        }
    } catch (error) {
        console.error('❌ Lỗi khi seed data:', error.message);
    }
};

// Gọi seed data sau 2 giây (đợi MongoDB connect)
setTimeout(seedDataIfFirstTime, 2000);

initWebRoutes(app);

let port = process.env.PORT || 8088;

app.listen(port, () => {
    console.log("Backend Nodejs (MongoDB) đang chạy tại port: " + port);
});