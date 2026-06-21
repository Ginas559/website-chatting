import mongoose from 'mongoose';
import LiveChatLevelOneBuffer from '../models/liveChatLevelOneBuffer.model';
import LiveChatModerationCase from '../models/liveChatModerationCase.model';
import LiveChatUnbanRequest from '../models/liveChatUnbanRequest.model';
import User from '../models/user';
import { createBanCase } from './liveChatBanPolicy.service';

const ROLE_META = {
    R1: { role: 'ADMIN' },
    R2: { role: 'USER' },
    R3: { role: 'MANAGER' },
    R4: { role: 'SHIPPER' },
};

const normalizeReason = (value) => String(value || '').trim();

const createError = (status, message, code = 'LIVE_CHAT_MODERATION_ERROR') => {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
};

const getDisplayName = (user) => {
    return `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Người dùng';
};

const toViolationComment = (content, moderationResult) => ({
    content: String(content || '').trim(),
    predictedLabel: Number(moderationResult.predictedLabel || 0),
    labelName: moderationResult.labelName || 'clean',
    confidence: Number(moderationResult.confidence || 0),
    probabilities: moderationResult.probabilities || {},
    source: moderationResult.source || 'AI_MODEL',
    createdAt: new Date(),
});

const getModeratedUser = async (userId, roleId) => {
    if (!mongoose.isValidObjectId(userId)) {
        throw createError(401, 'Bạn cần đăng nhập để bình luận', 'INVALID_USER');
    }

    const user = await User.findById(userId).select('email firstName lastName roleId').lean();
    if (!user) {
        throw createError(404, 'Không tìm thấy tài khoản', 'USER_NOT_FOUND');
    }

    const resolvedRoleId = roleId || user.roleId;
    return {
        _id: user._id,
        email: user.email,
        displayName: getDisplayName(user),
        roleId: resolvedRoleId,
        role: ROLE_META[resolvedRoleId]?.role || 'USER',
    };
};

const mapCase = (item) => {
    if (!item) return null;
    const doc = item.toObject ? item.toObject() : item;
    return {
        _id: doc._id,
        liveId: doc.liveId,
        userId: doc.userId,
        displayName: doc.displayName,
        role: doc.role,
        violationType: doc.violationType,
        comments: doc.comments || [],
        banDays: doc.banDays,
        banMultiplier: doc.banMultiplier,
        bannedUntil: doc.bannedUntil,
        isActive: doc.isActive,
        status: doc.status,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        unbanReason: doc.unbanReason,
        unbannedAt: doc.unbannedAt,
    };
};

const mapRequest = (item) => {
    if (!item) return null;
    const doc = item.toObject ? item.toObject() : item;
    return {
        _id: doc._id,
        moderationCaseId: doc.moderationCaseId,
        userId: doc.userId,
        reason: doc.reason,
        status: doc.status,
        adminReply: doc.adminReply,
        reviewedBy: doc.reviewedBy,
        reviewedAt: doc.reviewedAt,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
};

export const expireOutdatedBanCases = async (userId) => {
    const now = new Date();
    await LiveChatModerationCase.updateMany(
        {
            userId,
            isActive: true,
            status: 'ACTIVE',
            bannedUntil: { $lte: now },
        },
        { $set: { isActive: false, status: 'EXPIRED' } }
    );
};

export const getActiveBanCase = async (userId) => {
    await expireOutdatedBanCases(userId);
    const activeCase = await LiveChatModerationCase.findOne({
        userId,
        isActive: true,
        status: 'ACTIVE',
        bannedUntil: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    return activeCase;
};

export const createLevelTwoBan = async ({ liveId, userId, roleId, content, moderationResult }) => {
    const user = await getModeratedUser(userId, roleId);
    const comment = toViolationComment(content, moderationResult);
    const banCase = await createBanCase({
        liveId,
        user,
        violationType: 'LEVEL_2_SINGLE',
        comments: [comment],
    });

    return mapCase(banCase);
};

export const addLevelOneWarning = async ({ liveId, userId, roleId, content, moderationResult }) => {
    const user = await getModeratedUser(userId, roleId);
    const comment = toViolationComment(content, moderationResult);
    const buffer = await LiveChatLevelOneBuffer.findOneAndUpdate(
        { liveId, userId },
        { $push: { comments: comment } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if ((buffer.comments || []).length < 3) {
        return {
            banned: false,
            warningCount: buffer.comments.length,
            remainingWarnings: 3 - buffer.comments.length,
        };
    }

    const violationComments = buffer.comments.slice(0, 3);
    const banCase = await createBanCase({
        liveId,
        user,
        violationType: 'THREE_LEVEL_1_IN_LIVE',
        comments: violationComments,
    });

    await LiveChatLevelOneBuffer.deleteOne({ _id: buffer._id });

    return {
        banned: true,
        warningCount: 3,
        remainingWarnings: 0,
        banCase: mapCase(banCase),
    };
};

export const listModerationBans = async (query = {}) => {
    const filter = {};
    if (query.status) filter.status = query.status;
    if (mongoose.isValidObjectId(query.userId)) filter.userId = query.userId;
    if (mongoose.isValidObjectId(query.liveId)) filter.liveId = query.liveId;

    const items = await LiveChatModerationCase.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    return items.map(mapCase);
};

export const unbanModerationCase = async ({ caseId, currentUserId, reason = 'Gỡ ban thủ công' }) => {
    if (!mongoose.isValidObjectId(caseId)) {
        throw createError(400, 'Mã án phạt không hợp lệ', 'INVALID_CASE_ID');
    }

    const banCase = await LiveChatModerationCase.findByIdAndUpdate(
        caseId,
        {
            $set: {
                isActive: false,
                status: 'UNBANNED',
                unbannedBy: currentUserId,
                unbannedAt: new Date(),
                unbanReason: normalizeReason(reason) || 'Gỡ ban thủ công',
            },
        },
        { new: true }
    );

    if (!banCase) {
        throw createError(404, 'Không tìm thấy án phạt', 'CASE_NOT_FOUND');
    }

    return mapCase(banCase);
};

export const getMyModerationBans = async (userId) => {
    await expireOutdatedBanCases(userId);
    const items = await LiveChatModerationCase.find({ userId }).sort({ createdAt: -1 }).lean();
    return items.map(mapCase);
};

export const createUnbanRequest = async ({ caseId, userId, reason }) => {
    const cleanReason = normalizeReason(reason);
    if (!cleanReason || cleanReason.length < 5) {
        throw createError(400, 'Lý do xin gỡ ban tối thiểu 5 ký tự', 'INVALID_REASON');
    }

    const banCase = await LiveChatModerationCase.findOne({
        _id: caseId,
        userId,
        isActive: true,
        status: 'ACTIVE',
    }).lean();

    if (!banCase) {
        throw createError(404, 'Không tìm thấy án phạt đang hiệu lực của bạn', 'CASE_NOT_FOUND');
    }

    const request = await LiveChatUnbanRequest.findOneAndUpdate(
        { moderationCaseId: caseId, userId, status: 'PENDING' },
        { $setOnInsert: { moderationCaseId: caseId, userId, reason: cleanReason } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return mapRequest(request);
};

export const listUnbanRequests = async (query = {}) => {
    const filter = {};
    if (query.status) filter.status = query.status;
    const items = await LiveChatUnbanRequest.find(filter)
        .populate('moderationCaseId')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

    return items.map((item) => ({
        ...mapRequest(item),
        moderationCase: mapCase(item.moderationCaseId),
    }));
};

export const reviewUnbanRequest = async ({ requestId, status, adminReply = '', currentUserId }) => {
    if (!['APPROVED', 'REJECTED'].includes(status)) {
        throw createError(400, 'Trạng thái xử lý không hợp lệ', 'INVALID_REVIEW_STATUS');
    }

    const request = await LiveChatUnbanRequest.findById(requestId);
    if (!request) {
        throw createError(404, 'Không tìm thấy yêu cầu gỡ ban', 'REQUEST_NOT_FOUND');
    }
    if (request.status !== 'PENDING') {
        throw createError(400, 'Yêu cầu này đã được xử lý', 'REQUEST_ALREADY_REVIEWED');
    }

    request.status = status;
    request.adminReply = normalizeReason(adminReply);
    request.reviewedBy = currentUserId;
    request.reviewedAt = new Date();
    await request.save();

    let moderationCase = null;
    if (status === 'APPROVED') {
        moderationCase = await unbanModerationCase({
            caseId: request.moderationCaseId,
            currentUserId,
            reason: request.adminReply || 'Duyệt yêu cầu gỡ ban',
        });
    }

    return {
        request: mapRequest(request),
        moderationCase,
    };
};
