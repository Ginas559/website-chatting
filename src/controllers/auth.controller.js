import User from "../models/user.js";
import OTP from "../models/otp.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import { createTempToken, createAccessToken } from "../utils/jwt.js";
import { sendOTPEmail } from "../utils/email.js"; 

export const registerRequest = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { email, password, firstName, lastName } = req.body;
        
        const existingUser = await User.findOne({ email }); 
        if (existingUser) return res.status(400).json({ error: "Email đã được sử dụng" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const tempToken = createTempToken({ email, hashedPassword, firstName, lastName });
        
        await OTP.deleteMany({ email, purpose: 'register' });
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.create({ email, otp: otpCode, purpose: 'register' });

        await sendOTPEmail(email, otpCode);
        
        res.status(200).json({ 
            message: "OTP đã được gửi đến email của bạn. Vui lòng kiểm tra và xác nhận để hoàn tất.", 
            tempToken 
        });
    } catch (error) {
        console.error("Error in registerRequest:", error);
        res.status(500).json({ error: "Có lỗi xảy ra trong quá trình đăng ký" });
    }
}

export const verifyOTP = async (req, res) => { 
    const { otp, tempToken } = req.body;
    try {
        const decoded = jwt.verify(tempToken, process.env.JWT_TEMP_SECRET);
        const email = decoded.email;
        const otpCode = String(otp || '').trim();
        
        const validOTP = await OTP.findOne({ email, otp: otpCode, purpose: 'register' }); 
        if (!validOTP) return res.status(400).json({ error: "OTP không hợp lệ hoặc đã hết hạn" });

        const newUser = await User.create({
            firstName: decoded.firstName,
            lastName: decoded.lastName,
            email: decoded.email,
            password: decoded.hashedPassword,
            roleId: 'R2',
            isActive: true
        });

        await OTP.deleteOne({ _id: validOTP._id });
        const accessToken = createAccessToken(newUser);
        
        res.status(200).json({ message: "Đăng ký thành công", accessToken });
    } catch (error) {
        res.status(400).json({ error: "Token không hợp lệ hoặc đã hết hạn" });
    }
}

export const forgotPasswordRequest = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email } = req.body;

        const existingUser = await User.findOne({ email });
        if (!existingUser) {
            return res.status(400).json({ error: "Email không tồn tại trong hệ thống" });
        }

        const tempToken = createTempToken({ email, purpose: 'reset-password' });

        await OTP.deleteMany({ email, purpose: 'reset-password' });
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.create({ email, otp: otpCode, purpose: 'reset-password' });

        await sendOTPEmail(email, otpCode);

        res.status(200).json({
            message: "OTP đổi mật khẩu đã được gửi đến email của bạn.",
            tempToken
        });
    } catch (error) {
        console.error("Error in forgotPasswordRequest:", error);
        res.status(500).json({ error: "Có lỗi xảy ra trong quá trình gửi OTP đổi mật khẩu" });
    }
}

export const resetPassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { otp, newPassword, tempToken } = req.body;

    try {
        const decoded = jwt.verify(tempToken, process.env.JWT_TEMP_SECRET);
        if (decoded.purpose !== 'reset-password') {
            return res.status(400).json({ error: "Token không hợp lệ" });
        }

        const email = decoded.email;
        const otpCode = String(otp || '').trim();
        const validOTP = await OTP.findOne({ email, otp: otpCode, purpose: 'reset-password' });
        if (!validOTP) {
            return res.status(400).json({ error: "OTP không hợp lệ hoặc đã hết hạn" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.updateOne({ email }, { password: hashedPassword });
        await OTP.deleteOne({ _id: validOTP._id });

        res.status(200).json({ message: "Đổi mật khẩu thành công" });
    } catch (error) {
        console.error("Error in resetPassword:", error);
        res.status(400).json({ error: "Token không hợp lệ hoặc đã hết hạn" });
    }
}
