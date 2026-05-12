import mongoose from 'mongoose';

const connectDB = async () => {
    try {
       
        const uri = process.env.MONGO_URI; 
        
        if (!uri) {
            throw new Error("MONGO_URI không tồn tại trong file .env!");
        }

        await mongoose.connect(uri);
        console.log('Kết nối MongoDB thành công!');
    } catch (error) {
        console.error('Kết nối MongoDB thất bại:', error);
    }
}

export default connectDB; 