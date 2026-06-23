import mongoose from 'mongoose';
import User from '../src/models/user.js';
require('dotenv').config();

const run = async () => {
    const mongoUri = process.env.MONGO_DB_URL || 'mongodb://localhost:27017/btvn01';
    await mongoose.connect(mongoUri);
    console.log('Connected to DB:', mongoUri);
    
    const users = await User.find({}, 'email roleId firstName lastName');
    console.log('Users in DB:');
    users.forEach(u => {
        console.log(`- ID: ${u._id}, Email: ${u.email}, Role: ${u.roleId}, Name: ${u.firstName} ${u.lastName}`);
    });
    
    await mongoose.disconnect();
};

run().catch(console.error);
