import ChatMessage from '../models/chatMessage.model.js';
import User from '../models/user.js';
import { sendSocketChatMessage } from '../sockets/chat.socket.js';

// Bug 1: Empty message check bypass (allows whitespace-only messages)
export const sendMessage = async (req, res) => {
    try {
        const { receiverId, content } = req.body;
        const senderId = req.user.id;

        // Fix Bug 1: Trim content and check for whitespace-only messages
        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống' });
        }

        const message = await ChatMessage.create({
            senderId,
            receiverId,
            content
        });

        // Broadcast/Emit via socket (will contain Bug 2 in socket module)
        sendSocketChatMessage(senderId, receiverId, message);

        return res.status(200).json({ success: true, message });
    } catch (error) {
        console.error('Send message error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ' });
    }
};

// Bug 3: Swaps/Limits query to only search senderId = senderId (one-way history bug)
// Bug 4: Lack of authorization check (IDOR vulnerability) - Anyone can pass any senderId & receiverId
// Bug 5: Sorting mismatch (returns descending newest first, causing flipped display on reload)
export const getHistory = async (req, res) => {
    try {
        const { senderId, receiverId } = req.params;

        // Fix Bug 4: Prevent IDOR - ensure requesting user is either the sender, receiver, or a staff/admin (R1/R3)
        if (req.user.roleId !== 'R1' && req.user.roleId !== 'R3' && req.user.id !== senderId && req.user.id !== receiverId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập lịch sử cuộc trò chuyện này' });
        }

        // Fix Bug 3: Query both directions of the conversation
        const messages = await ChatMessage.find({
            $or: [
                { senderId: senderId, receiverId: receiverId },
                { senderId: receiverId, receiverId: senderId }
            ]
        })
        .sort({ createdAt: 1 }) // Fix Bug 5: Sort ascending (oldest first, newest last)
        .lean();

        return res.status(200).json({ success: true, data: messages });
    } catch (error) {
        console.error('Get history error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ' });
    }
};

// Bug 6: Incorrect updates fields (updates user's own sent messages instead of received messages)
export const markAsRead = async (req, res) => {
    try {
        const { senderId } = req.params;
        const receiverId = req.user.id;

        // Fix Bug 6: Correct filter to update isRead for messages received by the user
        const result = await ChatMessage.updateMany(
            { senderId: senderId, receiverId: receiverId, isRead: false },
            { $set: { isRead: true } }
        );

        return res.status(200).json({ success: true, updatedCount: result.modifiedCount });
    } catch (error) {
        console.error('Mark read error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ' });
    }
};

// Fetch list of contacts for Admin/Manager dashboard
export const getChatContacts = async (req, res) => {
    try {
        const uniqueSenders = await ChatMessage.distinct('senderId');
        const uniqueReceivers = await ChatMessage.distinct('receiverId');
        const allUserIds = [...new Set([...uniqueSenders, ...uniqueReceivers])];

        const filteredUserIds = allUserIds.filter(id => id.toString() !== req.user.id);

        const users = await User.find({ _id: { $in: filteredUserIds } }, 'email firstName lastName roleId image').lean();

        const contacts = await Promise.all(users.map(async (u) => {
            const unreadCount = await ChatMessage.countDocuments({
                senderId: u._id,
                receiverId: req.user.id,
                isRead: false
            });
            return {
                ...u,
                unreadCount
            };
        }));

        return res.status(200).json({ success: true, data: contacts });
    } catch (error) {
        console.error('Get chat contacts error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ' });
    }
};

// Get the main administrator profile for the customer to start chatting
export const getSupportUser = async (req, res) => {
    try {
        const support = await User.findOne({ roleId: 'R1' }, 'firstName lastName email image').lean();
        if (!support) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản hỗ trợ viên' });
        }
        return res.status(200).json({ success: true, data: support });
    } catch (error) {
        console.error('Get support user error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ' });
    }
};
