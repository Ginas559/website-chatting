import Notification from '../models/notification.model';
import User from '../models/user';
import { sendSocketNotification } from '../config/socket';
import nodemailer from 'nodemailer';

/**
 * Send notification email helper
 */
const sendNotificationEmail = async (toEmail, subject, title, htmlContent) => {
    // Check if email configuration is present
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('[Email Warning] EMAIL_USER or EMAIL_PASS not configured. Skipping email.');
        return;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: `"SmartZone Notifications" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: subject,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; border: 1px solid #f0f0f0; border-radius: 12px; max-width: 600px; margin: 20px auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%); padding: 15px; border-radius: 8px 8px 0 0; text-align: center; color: white;">
                    <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 1px;">SMARTZONE STORE</h2>
                </div>
                <div style="padding: 20px 10px; color: #333; line-height: 1.6;">
                    <h3 style="color: #ff5252; margin-top: 0; font-size: 18px;">${title}</h3>
                    <div style="font-size: 15px; margin-top: 15px;">
                        ${htmlContent}
                    </div>
                </div>
                <hr style="border: none; border-top: 1px solid #eeeeee; margin: 25px 0;" />
                <p style="font-size: 11px; color: #9aa0a6; text-align: center; margin: 0;">
                    Đây là email tự động từ hệ thống SmartZone Store. Vui lòng không trả lời thư này.<br/>
                    © 2026 SmartZone Store. All rights reserved.
                </p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[Email] Notification email sent successfully to ${toEmail}`);
    } catch (error) {
        console.error(`[Email Error] Failed to send email to ${toEmail}:`, error.message);
    }
};

/**
 * Creates, broadcasts (socket.io), and sends email notifications.
 * 
 * @param {Object} params
 * @param {string} params.recipientId - Direct recipient userId (optional)
 * @param {string} params.recipientRole - Target roleId (R1, R2, R3) (optional)
 * @param {string} params.type - Enum type of notification
 * @param {string} params.title - Title of notification
 * @param {string} params.content - Detail content
 * @param {string} params.link - UI target link on click
 * @param {string} params.senderId - Sender userId (optional)
 * @param {string} params.emailSubject - Custom subject for email (optional)
 */
export const createNotification = async ({
    recipientId = null,
    recipientRole = null,
    type,
    title,
    content,
    link = '',
    senderId = null,
    emailSubject = null,
}) => {
    try {
        // 1. Save to database
        const notification = await Notification.create({
            recipient: recipientId,
            recipientRole,
            type,
            title,
            content,
            link,
            sender: senderId,
        });

        // 2. Broadcast via WebSocket
        sendSocketNotification(recipientId, recipientRole, notification);

        // 3. Dispatch Emails asynchronously (not blocking response)
        const subject = emailSubject || `[SmartZone] ${title}`;
        const emailBody = `
            <p style="font-size: 15px;">Chào bạn,</p>
            <p style="font-size: 15px;">Hệ thống vừa ghi nhận một hoạt động mới:</p>
            <blockquote style="background-color: #f9f9f9; border-left: 4px solid #ff5252; padding: 12px; margin: 15px 0; font-style: italic;">
                ${content}
            </blockquote>
            ${link ? `<p style="margin-top: 20px;"><a href="http://localhost:5173${link}" style="background-color: #ff5252; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Xem chi tiết trên website</a></p>` : ''}
        `;

        if (recipientId) {
            // Find specific user's email
            const user = await User.findById(recipientId).lean();
            if (user && user.email) {
                sendNotificationEmail(user.email, subject, title, emailBody).catch(err => {
                    console.error('[Notification Dispatch] Specific Email error:', err);
                });
            }
        } else if (recipientRole) {
            // Find all users with this role
            const targetUsers = await User.find({ roleId: recipientRole }).select('email').lean();
            targetUsers.forEach(user => {
                if (user.email) {
                    sendNotificationEmail(user.email, subject, title, emailBody).catch(err => {
                        console.error('[Notification Dispatch] Role Email error:', err);
                    });
                }
            });
        } else {
            // Public notifications (broadcast to R2 users - customers)
            // For safety and resource limit in dev environment, send to all R2 users
            const customers = await User.find({ roleId: 'R2' }).select('email').lean();
            customers.forEach(user => {
                if (user.email) {
                    sendNotificationEmail(user.email, subject, title, emailBody).catch(err => {
                        console.error('[Notification Dispatch] Public Email error:', err);
                    });
                }
            });
        }

        return notification;
    } catch (error) {
        console.error('[Notification Dispatch Error]:', error);
        // Do not crash the parent transaction if notification saving/sending fails
        return null;
    }
};
