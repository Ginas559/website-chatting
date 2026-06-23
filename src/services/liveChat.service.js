import mongoose from 'mongoose';
import LiveChatMessage from '../models/liveChatMessage.model';
import Livestream from '../models/livestream.model';
import User from '../models/user';

const ROLE_META = {
    R1: { role: 'ADMIN', color: 'yellow' },
    R2: { role: 'USER', color: 'white' },
    R3: { role: 'MANAGER', color: 'purple' },
    R4: { role: 'SHIPPER', color: 'green' },
};

const normalizeContent = (content) => String(content || '').trim();

const toClientMessage = (message) => {
    if (!message) return null;
    const doc = message.toObject ? message.toObject() : message;

    return {
        _id: doc._id,
        liveId: doc.liveId,
        userId: doc.userId,
        displayName: doc.displayName,
        role: doc.role,
        content: doc.isDeleted ? 'Tin nhắn đã bị xóa' : doc.content,
        color: doc.color,
        isPinned: Boolean(doc.isPinned),
        isDeleted: Boolean(doc.isDeleted),
        createdAt: doc.createdAt,
    };
};

const createChatError = (status, message, code = 'LIVE_CHAT_ERROR') => {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
};

const assertLiveId = (liveId) => {
    if (!mongoose.isValidObjectId(liveId)) {
        throw createChatError(400, 'Livestream không hợp lệ', 'INVALID_LIVE_ID');
    }
};

const getDisplayName = (user) => {
    return `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Người dùng';
};

const getRoleMeta = (roleId) => ROLE_META[roleId] || ROLE_META.R2;

export const getRecentMessages = async (liveId, limit = 50) => {
    assertLiveId(liveId);
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 50);

    const messages = await LiveChatMessage.find({ liveId, isDeleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(safeLimit)
        .lean();

    return messages.reverse().map(toClientMessage);
};

export const assertLiveChatAvailable = async (liveId) => {
    assertLiveId(liveId);
    const livestream = await Livestream.findOne({ _id: liveId, status: 'LIVE' }).lean();
    if (!livestream) {
        throw createChatError(404, 'Livestream không còn hoạt động', 'LIVE_NOT_FOUND');
    }
    return livestream;
};

export const createMessage = async ({ liveId, userId, roleId, content }) => {
    await assertLiveChatAvailable(liveId);

    if (!mongoose.isValidObjectId(userId)) {
        throw createChatError(401, 'Bạn cần đăng nhập để bình luận', 'INVALID_USER');
    }

    const normalizedContent = normalizeContent(content);
    if (!normalizedContent) {
        throw createChatError(400, 'Nội dung bình luận không được để trống', 'EMPTY_CONTENT');
    }
    if (normalizedContent.length > 200) {
        throw createChatError(400, 'Bình luận tối đa 200 ký tự', 'CONTENT_TOO_LONG');
    }

    const user = await User.findById(userId).select('email firstName lastName roleId').lean();
    if (!user) {
        throw createChatError(404, 'Không tìm thấy tài khoản', 'USER_NOT_FOUND');
    }

    const roleMeta = getRoleMeta(roleId || user.roleId);
    const message = await LiveChatMessage.create({
        liveId,
        userId,
        displayName: getDisplayName(user),
        role: roleMeta.role,
        content: normalizedContent,
        color: roleMeta.color,
    });

    return toClientMessage(message);
};

export const deleteMessage = async (messageId, currentUser) => {
    if (!['R1', 'R3'].includes(currentUser?.roleId)) {
        throw createChatError(403, 'Bạn không có quyền xóa bình luận', 'CHAT_DELETE_FORBIDDEN');
    }

    const message = await LiveChatMessage.findByIdAndUpdate(
        messageId,
        { $set: { isDeleted: true, isPinned: false } },
        { new: true }
    );

    if (!message) {
        throw createChatError(404, 'Không tìm thấy bình luận', 'MESSAGE_NOT_FOUND');
    }

    return toClientMessage(message);
};

export const pinMessage = async (messageId, currentUser) => {
    if (currentUser?.roleId !== 'R1') {
        throw createChatError(403, 'Chỉ Admin được ghim bình luận', 'CHAT_PIN_FORBIDDEN');
    }

    const message = await LiveChatMessage.findOne({ _id: messageId, isDeleted: { $ne: true } });
    if (!message) {
        throw createChatError(404, 'Không tìm thấy bình luận', 'MESSAGE_NOT_FOUND');
    }

    await LiveChatMessage.updateMany(
        { liveId: message.liveId, _id: { $ne: message._id } },
        { $set: { isPinned: false } }
    );

    message.isPinned = true;
    await message.save();

    return toClientMessage(message);
};
