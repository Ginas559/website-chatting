import { verifyAccessToken } from '../utils/jwt';
import { endCurrentLivestreamService } from '../services/livestream.service';
import {
    addViewer,
    clearActiveLivestreamAdmin,
    clearViewers,
    getViewerCount,
    MAX_VIEWERS,
    removeViewer,
    setActiveLivestreamAdmin,
} from './livestream.state';
import {
    assertLiveChatAvailable,
    createMessage,
    deleteMessage,
    pinMessage,
} from '../services/liveChat.service';
import { moderateLiveChatMessage } from '../services/chatModeration.service';
import {
    addLevelOneWarning,
    createLevelTwoBan,
    getActiveBanCase,
} from '../services/liveChatModeration.service';

const LIVESTREAM_ADMIN_ROOM = 'livestream-admin';
const LIVESTREAM_USERS_ROOM = 'livestream-users';
const CHAT_RATE_LIMIT_MS = 2000;

const connectedClients = new Map();
const chatLastSentAt = new Map();

const parseUserFromSocket = (socket) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    return token ? verifyAccessToken(token) : null;
};

const requireAuth = (socket) => {
    const user = parseUserFromSocket(socket);

    if (!user) {
        socket.emit('livestream-error', { message: 'Bạn không có quyền sử dụng livestream' });
        return null;
    }

    socket.data.user = user;
    connectedClients.set(socket.id, user);
    return user;
};

const requireRole = (socket, roleId) => {
    const user = requireAuth(socket);

    if (!user || user.roleId !== roleId) {
        socket.emit('livestream-error', { message: 'Bạn không có quyền sử dụng livestream' });
        return null;
    }

    return user;
};

const requireAnyRole = (socket, roleIds) => {
    const user = requireAuth(socket);

    if (!user || !roleIds.includes(user.roleId)) {
        socket.emit('livestream-error', { message: 'Bạn không có quyền sử dụng livestream' });
        return null;
    }

    return user;
};

const getLiveId = (payload = {}, socket) => payload.liveId || payload.livestreamId || socket.data.livestreamId || '';

const emitViewerCount = (io, liveId) => {
    io.to(LIVESTREAM_ADMIN_ROOM).emit('viewer-count-updated', {
        liveId,
        viewerCount: getViewerCount(liveId),
        maxViewers: MAX_VIEWERS,
    });
};

const emitChatError = (socket, message) => {
    socket.emit('live-chat-error', { message });
};

export const registerLivestreamSocket = (io, socket) => {
    socket.on('admin-start-live', (payload = {}) => {
        const admin = requireRole(socket, 'R1');
        if (!admin) return;

        const liveId = getLiveId(payload, socket);
        socket.join(LIVESTREAM_ADMIN_ROOM);
        socket.data.livestreamRole = 'ADMIN';
        socket.data.livestreamId = liveId;
        setActiveLivestreamAdmin({
            socketId: socket.id,
            livestreamId: liveId,
        });

        io.to(LIVESTREAM_USERS_ROOM).emit('admin-start-live', {
            liveId,
            livestreamId: liveId,
            title: payload.title,
            description: payload.description,
        });
        emitViewerCount(io, liveId);
    });

    socket.on('user-join-live', (payload = {}) => {
        const user = requireAnyRole(socket, ['R2', 'R3', 'R4']);
        if (!user) return;

        const liveId = getLiveId(payload, socket);
        const joinResult = addViewer({ liveId, userId: user.id, socketId: socket.id });

        if (!joinResult.accepted) {
            socket.emit('livestream-error', {
                liveId,
                message: joinResult.reason === 'MAX_VIEWERS'
                    ? 'Livestream hiện đã đạt giới hạn người xem.'
                    : 'Không thể tham gia livestream.',
            });
            return;
        }

        if (joinResult.replacedSocketId) {
            io.to(LIVESTREAM_ADMIN_ROOM).emit('user-disconnect', {
                liveId,
                userSocketId: joinResult.replacedSocketId,
            });
        }

        socket.join(LIVESTREAM_USERS_ROOM);
        socket.data.livestreamRole = 'USER';
        socket.data.livestreamId = liveId;
        socket.data.livestreamUserId = user.id;

        io.to(LIVESTREAM_ADMIN_ROOM).emit('user-joined', {
            liveId,
            userSocketId: socket.id,
            userId: user.id,
        });
        emitViewerCount(io, liveId);
    });

    socket.on('offer', ({ liveId, targetSocketId, offer }) => {
        const currentLiveId = liveId || socket.data.livestreamId;
        if (socket.data.livestreamRole !== 'ADMIN' || !currentLiveId || !targetSocketId || !offer) return;
        io.to(targetSocketId).emit('offer', {
            liveId: currentLiveId,
            fromSocketId: socket.id,
            offer,
        });
    });

    socket.on('answer', ({ liveId, targetSocketId, answer }) => {
        const currentLiveId = liveId || socket.data.livestreamId;
        if (socket.data.livestreamRole !== 'USER' || !currentLiveId || !targetSocketId || !answer) return;
        io.to(targetSocketId).emit('answer', {
            liveId: currentLiveId,
            fromSocketId: socket.id,
            answer,
        });
    });

    socket.on('ice-candidate', ({ liveId, targetSocketId, candidate }) => {
        const currentLiveId = liveId || socket.data.livestreamId;
        if (!currentLiveId || !targetSocketId || !candidate) return;
        io.to(targetSocketId).emit('ice-candidate', {
            liveId: currentLiveId,
            fromSocketId: socket.id,
            candidate,
        });
    });

    socket.on('admin-end-live', async (payload = {}) => {
        if (socket.data.livestreamRole !== 'ADMIN') return;

        const liveId = getLiveId(payload, socket);
        await endCurrentLivestreamService().catch(() => null);
        io.to(LIVESTREAM_USERS_ROOM).emit('admin-end-live', {
            liveId,
            livestreamId: liveId,
        });

        socket.leave(LIVESTREAM_ADMIN_ROOM);
        clearViewers(liveId);
        clearActiveLivestreamAdmin(socket.id);
        socket.data.livestreamRole = '';
        socket.data.livestreamId = '';
        emitViewerCount(io, liveId);
    });

    socket.on('user-disconnect', (payload = {}) => {
        if (socket.data.livestreamRole === 'ADMIN' && payload.userSocketId) {
            const liveId = getLiveId(payload, socket);
            removeViewer({ liveId, socketId: payload.userSocketId });
            io.to(LIVESTREAM_ADMIN_ROOM).emit('user-disconnect', {
                liveId,
                userSocketId: payload.userSocketId,
            });
            emitViewerCount(io, liveId);
            return;
        }

        if (socket.data.livestreamRole !== 'USER') return;

        const liveId = getLiveId(payload, socket);
        removeViewer({ liveId, userId: socket.data.livestreamUserId, socketId: socket.id });
        io.to(LIVESTREAM_ADMIN_ROOM).emit('user-disconnect', {
            liveId,
            userSocketId: socket.id,
        });

        socket.leave(LIVESTREAM_USERS_ROOM);
        socket.data.livestreamRole = '';
        socket.data.livestreamId = '';
        socket.data.livestreamUserId = '';
        emitViewerCount(io, liveId);
    });

    socket.on('join-live-chat', async ({ liveId }) => {
        const user = requireAuth(socket);
        if (!user) return;

        try {
            await assertLiveChatAvailable(liveId);
            socket.join(`live-chat:${liveId}`);
            socket.data.chatLiveId = liveId;
        } catch (error) {
            emitChatError(socket, error?.message || 'Không thể tham gia chat livestream');
        }
    });

    socket.on('send-live-chat-message', async ({ liveId, content }) => {
        const user = requireAuth(socket);
        if (!user) return;

        const rateKey = `${liveId}:${user.id}`;
        const now = Date.now();
        const lastSentAt = chatLastSentAt.get(rateKey) || 0;

        if (now - lastSentAt < CHAT_RATE_LIMIT_MS) {
            emitChatError(socket, 'Bạn đang gửi bình luận quá nhanh.');
            return;
        }

        try {
            await assertLiveChatAvailable(liveId);

            const activeBan = await getActiveBanCase(user.id);
            if (activeBan) {
                socket.emit('live-chat-banned', {
                    message: 'Bạn đang bị khóa chat do vi phạm quy định.',
                    bannedUntil: activeBan.bannedUntil,
                    banDays: activeBan.banDays,
                    moderationCaseId: activeBan._id,
                });
                return;
            }

            const moderationResult = await moderateLiveChatMessage({ content });
            const shouldApplyAiBan = ['R2', 'R4'].includes(user.roleId);

            if (moderationResult.predictedLabel >= 2 && shouldApplyAiBan) {
                const banCase = await createLevelTwoBan({
                    liveId,
                    userId: user.id,
                    roleId: user.roleId,
                    content,
                    moderationResult,
                });

                chatLastSentAt.set(rateKey, now);
                socket.emit('live-chat-banned', {
                    message: 'Bình luận vi phạm nghiêm trọng. Bạn đã bị khóa chat.',
                    bannedUntil: banCase.bannedUntil,
                    banDays: banCase.banDays,
                    moderationCaseId: banCase._id,
                });
                io.to(`live-chat:${liveId}`).emit('live-chat-user-banned', {
                    liveId,
                    banCase,
                });
                return;
            }

            if (moderationResult.predictedLabel === 1 && shouldApplyAiBan) {
                const warningResult = await addLevelOneWarning({
                    liveId,
                    userId: user.id,
                    roleId: user.roleId,
                    content,
                    moderationResult,
                });

                chatLastSentAt.set(rateKey, now);
                if (warningResult.banned) {
                    socket.emit('live-chat-banned', {
                        message: 'Bạn đã có 3 bình luận chưa phù hợp trong cùng phiên live nên bị khóa chat.',
                        bannedUntil: warningResult.banCase.bannedUntil,
                        banDays: warningResult.banCase.banDays,
                        moderationCaseId: warningResult.banCase._id,
                    });
                    io.to(`live-chat:${liveId}`).emit('live-chat-user-banned', {
                        liveId,
                        banCase: warningResult.banCase,
                    });
                    return;
                }

                socket.emit('live-chat-warning', {
                    message: 'Bình luận của bạn chưa phù hợp. Nếu vi phạm 3 lần trong cùng phiên live, bạn sẽ bị khóa chat.',
                    warningCount: warningResult.warningCount,
                    remainingWarnings: warningResult.remainingWarnings,
                });
                return;
            }

            if (moderationResult.predictedLabel > 0 && ['R1', 'R3'].includes(user.roleId)) {
                socket.emit('live-chat-warning', {
                    message: 'AI phát hiện bình luận có rủi ro, nhưng tài khoản nhân sự không bị tự động khóa.',
                    moderationResult,
                });
            }

            const message = await createMessage({
                liveId,
                userId: user.id,
                roleId: user.roleId,
                content,
            });
            chatLastSentAt.set(rateKey, now);
            io.to(`live-chat:${liveId}`).emit('receive-live-chat-message', {
                liveId,
                message,
            });
        } catch (error) {
            emitChatError(socket, error?.message || 'Không thể gửi bình luận');
        }
    });

    socket.on('delete-live-chat-message', async ({ liveId, messageId }) => {
        const user = requireAuth(socket);
        if (!user) return;

        try {
            const message = await deleteMessage(messageId, user);
            io.to(`live-chat:${liveId || message.liveId}`).emit('live-chat-message-deleted', {
                liveId: liveId || message.liveId,
                message,
            });
        } catch (error) {
            emitChatError(socket, error?.message || 'Không thể xóa bình luận');
        }
    });

    socket.on('pin-live-chat-message', async ({ liveId, messageId }) => {
        const user = requireAuth(socket);
        if (!user) return;

        try {
            const message = await pinMessage(messageId, user);
            io.to(`live-chat:${liveId || message.liveId}`).emit('live-chat-message-pinned', {
                liveId: liveId || message.liveId,
                message,
            });
        } catch (error) {
            emitChatError(socket, error?.message || 'Không thể ghim bình luận');
        }
    });

    socket.on('disconnect', async () => {
        connectedClients.delete(socket.id);

        if (socket.data.livestreamRole === 'ADMIN') {
            const liveId = socket.data.livestreamId || '';
            await endCurrentLivestreamService().catch(() => null);
            clearActiveLivestreamAdmin(socket.id);
            clearViewers(liveId);
            io.to(LIVESTREAM_USERS_ROOM).emit('admin-end-live', {
                liveId,
                livestreamId: liveId,
            });
            emitViewerCount(io, liveId);
        }

        if (socket.data.livestreamRole === 'USER') {
            const liveId = socket.data.livestreamId || '';
            removeViewer({ liveId, userId: socket.data.livestreamUserId, socketId: socket.id });
            io.to(LIVESTREAM_ADMIN_ROOM).emit('user-disconnect', {
                liveId,
                userSocketId: socket.id,
            });
            emitViewerCount(io, liveId);
        }
    });
};
