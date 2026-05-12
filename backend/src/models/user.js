import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        lowercase: true
    },
    password: { 
        type: String, 
        required: true 
    },
    firstName: { type: String, required: true},
    lastName: { type: String, required: true },
    address: { type: String },
    phoneNumber: { type: String },
    gender: { 
        type: Boolean, 
        default: false 
    },
    image: { type: String },
    roleId: { type: String, default: 'R2' },
    positionId: { type: String },
    isActive: { type: Boolean, default: false }
}, {
    timestamps: true 
});

const User = mongoose.model('User', userSchema);
export default User;