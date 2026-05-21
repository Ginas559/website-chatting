import mongoose from 'mongoose';
import { seedInitialData } from '../seed/autoSeed';

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_DB_URL || process.env.MONGO_URI;
        
        if (!uri) {
            throw new Error('MONGO_DB_URL hoặc MONGO_URI không tồn tại trong file .env!');
        }

        await mongoose.connect(uri);
        console.log('Kết nối MongoDB thành công!');

        // Seed dữ liệu khởi tạo chỉ khi biến môi trường SEED_INITIAL_DATA=true
        if (process.env.SEED_INITIAL_DATA === 'true') {
            console.log('SEED_INITIAL_DATA=true -> running seedInitialData()');
            await seedInitialData();
        } else {
            console.log('SEED_INITIAL_DATA not set to true -> skipping initial data seed.');
        }
    } catch (error) {
        console.error('Kết nối MongoDB thất bại:', error);
    }
}

export default connectDB; 