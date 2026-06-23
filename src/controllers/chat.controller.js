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
        const { before, limit = 20 } = req.query || {};

        // Fix Bug 4: Prevent IDOR - ensure requesting user is either the sender, receiver, or a staff/admin (R1/R3)
        if (req.user.roleId !== 'R1' && req.user.roleId !== 'R3' && req.user.id !== senderId && req.user.id !== receiverId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập lịch sử cuộc trò chuyện này' });
        }

        const limitNum = parseInt(limit, 10) || 20;
        const query = {
            $or: [
                { senderId: senderId, receiverId: receiverId },
                { senderId: receiverId, receiverId: senderId }
            ]
        };

        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        // Fetch newest first for pagination, then we will reverse
        const messages = await ChatMessage.find(query)
            .sort({ createdAt: -1 })
            .limit(limitNum)
            .lean();

        // Reverse to return ascending chronological order (oldest first)
        messages.reverse();

        return res.status(200).json({ success: true, data: messages, hasMore: messages.length === limitNum });
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
        let uniqueSenders, uniqueReceivers;
        if (req.user.roleId === 'R1' || req.user.roleId === 'R3') {
            uniqueSenders = await ChatMessage.distinct('senderId');
            uniqueReceivers = await ChatMessage.distinct('receiverId');
        } else {
            uniqueSenders = await ChatMessage.distinct('senderId', { receiverId: req.user.id });
            uniqueReceivers = await ChatMessage.distinct('receiverId', { senderId: req.user.id });
        }
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

export const getChatUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id, 'email firstName lastName roleId image').lean();
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }
        return res.status(200).json({ success: true, data: user });
    } catch (error) {
        console.error('Get chat user by id error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ' });
    }
};

export const getChatUsers = async (req, res) => {
    try {
        const users = await User.find(
            { _id: { $ne: req.user.id } },
            'email firstName lastName roleId image'
        ).lean();
        return res.status(200).json({ success: true, data: users });
    } catch (error) {
        console.error('Get chat users error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ' });
    }
};


