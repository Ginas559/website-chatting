import Notification from '../models/notification.model';

export const getMyNotifications = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const roleId = req.user?.roleId || 'R2';

        if (!userId) {
            return res.status(401).json({
                success: false,
                errCode: -2,
                errMessage: 'Chưa đăng nhập',
            });
        }

        // Query: private, role-based, or public notifications
        const query = {
            $or: [
                { recipient: userId },
                { recipientRole: roleId },
                { recipient: null, recipientRole: null }
            ]
        };

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(50) // Return last 50 notifications
            .lean();

        // Calculate unread count
        const unreadCount = await Notification.countDocuments({
            ...query,
            isRead: false
        });

        return res.status(200).json({
            success: true,
            errCode: 0,
            errMessage: 'Lấy danh sách thông báo thành công',
            data: {
                notifications,
                unreadCount
            }
        });
    } catch (error) {
        console.error('[Notification Controller Error]:', error);
        return res.status(500).json({
            success: false,
            errCode: -1,
            errMessage: 'Lỗi server khi lấy thông báo',
            error: error.message
        });
    }
};

export const markAsRead = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                errCode: -2,
                errMessage: 'Chưa đăng nhập',
            });
        }

        const notification = await Notification.findById(id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                errCode: 1,
                errMessage: 'Không tìm thấy thông báo',
            });
        }

        // Ensure user is authorized to read this notification
        const isRecipient = notification.recipient && notification.recipient.toString() === userId.toString();
        const isRoleRecipient = notification.recipientRole && notification.recipientRole === req.user?.roleId;
        const isPublic = !notification.recipient && !notification.recipientRole;

        if (!isRecipient && !isRoleRecipient && !isPublic) {
            return res.status(403).json({
                success: false,
                errCode: -3,
                errMessage: 'Bạn không có quyền đọc thông báo này',
            });
        }

        notification.isRead = true;
        await notification.save();

        return res.status(200).json({
            success: true,
            errCode: 0,
            errMessage: 'Đã đánh dấu thông báo đã đọc',
            data: notification
        });
    } catch (error) {
        console.error('[Notification Controller Error]:', error);
        return res.status(500).json({
            success: false,
            errCode: -1,
            errMessage: 'Lỗi server khi cập nhật thông báo',
            error: error.message
        });
    }
};

export const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const roleId = req.user?.roleId || 'R2';

        if (!userId) {
            return res.status(401).json({
                success: false,
                errCode: -2,
                errMessage: 'Chưa đăng nhập',
            });
        }

        const query = {
            $or: [
                { recipient: userId },
                { recipientRole: roleId },
                { recipient: null, recipientRole: null }
            ],
            isRead: false
        };

        await Notification.updateMany(query, {
            $set: { isRead: true }
        });

        return res.status(200).json({
            success: true,
            errCode: 0,
            errMessage: 'Đã đánh dấu tất cả thông báo là đã đọc'
        });
    } catch (error) {
        console.error('[Notification Controller Error]:', error);
        return res.status(500).json({
            success: false,
            errCode: -1,
            errMessage: 'Lỗi server khi cập nhật tất cả thông báo',
            error: error.message
        });
    }
};
