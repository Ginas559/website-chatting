import nodemailer from 'nodemailer';

export const sendOTPEmail = async (email, otp) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS  
        }
    });

    const mailOptions = {
        from: `"Hệ thống Chat App" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Mã xác thực OTP của bạn',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
                <h2 style="color: #4CAF50;">Xác nhận đăng ký</h2>
                <p>Chào bạn, mã OTP để hoàn tất đăng ký tài khoản là:</p>
                <h1 style="background: #f4f4f4; padding: 10px; text-align: center; color: #333;">${otp}</h1>
                <p>Mã này sẽ hết hạn sau <b>5 phút</b>.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[Email] Đã gửi OTP đến: ${email}`);
    } catch (error) {
        console.error('Lỗi gửi mail:', error);
        throw new Error('Gửi mail thất bại');
    }
};