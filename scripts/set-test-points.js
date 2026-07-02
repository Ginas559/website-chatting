// Tien - Script tiện ích để đặt nhanh điểm tích lũy cho tất cả tài khoản phục vụ việc test
import mongoose from 'mongoose';
import User from '../src/models/user.js';

require('dotenv').config();

const run = async () => {
    const mongoUri = process.env.MONGO_DB_URL || process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error('Không tìm thấy chuỗi kết nối MongoDB trong biến môi trường.');
    }

    await mongoose.connect(mongoUri);

    try {
        // Tiến hành đặt 50 điểm cho tất cả người dùng trong hệ thống để test
        const result = await User.updateMany(
            {},
            { $set: { rewardPoints: 50 } }
        );
        
        console.log(`=== ĐÃ CẬP NHẬT ĐIỂM TEST THÀNH CÔNG ===`);
        console.log(`Đã đặt 50 điểm tích lũy (tương đương 50,000đ) cho tất cả ${result.matchedCount} tài khoản.`);
        
        // Lấy danh sách tài khoản ra in để người dùng dễ đăng nhập kiểm thử
        const users = await User.find({}).select('email rewardPoints').lean();
        console.log('\nDanh sách tài khoản khách hàng hiện tại:');
        users.forEach((u, i) => {
            console.log(`${i + 1}. Email: ${u.email} | Điểm hiện có: ${u.rewardPoints || 0} điểm`);
        });
    } finally {
        await mongoose.disconnect();
    }
};

run().catch((error) => {
    console.error('Lỗi khi chạy script cập nhật điểm:', error);
    process.exitCode = 1;
});
