import nodemailer from 'nodemailer';

const getOTPEmailContent = (otp, purpose) => {
    if (purpose === 'reset-password') {
        return {
            subject: 'Mã OTP đặt lại mật khẩu',
            title: 'Đặt lại mật khẩu',
            message: 'Chào bạn, mã OTP để đặt lại mật khẩu là:'
        };
    }

    return {
        subject: 'Mã OTP xác nhận đăng ký',
        title: 'Xác nhận đăng ký',
        message: 'Chào bạn, mã OTP để hoàn tất đăng ký tài khoản là:'
    };
};

export const sendOTPEmail = async (email, otp, purpose = 'register') => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS  
        }
    });

    const content = getOTPEmailContent(otp, purpose);

    const mailOptions = {
        from: `"SmartZone - Web bán hàng công nghệ" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: content.subject,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
                <h2 style="color: #4CAF50;">${content.title}</h2>
                <p>${content.message}</p>
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
