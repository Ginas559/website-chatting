import { verifyAccessToken } from '../utils/jwt';
import { endCurrentLivestreamService } from '../services/livestream.service';
import { clearActiveLivestreamAdmin, setActiveLivestreamAdmin } from './livestream.state';

const LIVESTREAM_ADMIN_ROOM = 'livestream-admin';
const LIVESTREAM_USERS_ROOM = 'livestream-users';

const connectedClients = new Map();

const parseUserFromSocket = (socket) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    return token ? verifyAccessToken(token) : null;
};

const requireRole = (socket, roleId) => {
    const user = parseUserFromSocket(socket);

    if (!user || user.roleId !== roleId) {
        socket.emit('livestream-error', { message: 'Bạn không có quyền sử dụng livestream' });
        return null;
    }

    connectedClients.set(socket.id, user);
    return user;
};

export const registerLivestreamSocket = (io, socket) => {
    socket.on('admin-start-live', (payload = {}) => {
        const admin = requireRole(socket, 'R1');
        if (!admin) return;

        socket.join(LIVESTREAM_ADMIN_ROOM);
        socket.data.livestreamRole = 'ADMIN';
        socket.data.livestreamId = payload.livestreamId || '';
        setActiveLivestreamAdmin({
            socketId: socket.id,
            livestreamId: socket.data.livestreamId,
        });

        io.to(LIVESTREAM_USERS_ROOM).emit('admin-start-live', {
            livestreamId: payload.livestreamId,
            title: payload.title,
            description: payload.description,
        });
    });

    socket.on('user-join-live', (payload = {}) => {
        const user = requireRole(socket, 'R2');
        if (!user) return;

        socket.join(LIVESTREAM_USERS_ROOM);
        socket.data.livestreamRole = 'USER';
        socket.data.livestreamId = payload.livestreamId || '';

        io.to(LIVESTREAM_ADMIN_ROOM).emit('user-joined', {
            userSocketId: socket.id,
            userId: user.id,
        });
    });

    socket.on('offer', ({ targetSocketId, offer }) => {
        if (socket.data.livestreamRole !== 'ADMIN' || !targetSocketId || !offer) return;
        io.to(targetSocketId).emit('offer', {
            fromSocketId: socket.id,
            offer,
        });
    });

    socket.on('answer', ({ targetSocketId, answer }) => {
        if (socket.data.livestreamRole !== 'USER' || !targetSocketId || !answer) return;
        io.to(targetSocketId).emit('answer', {
            fromSocketId: socket.id,
            answer,
        });
    });

    socket.on('ice-candidate', ({ targetSocketId, candidate }) => {
        if (!targetSocketId || !candidate) return;
        io.to(targetSocketId).emit('ice-candidate', {
            fromSocketId: socket.id,
            candidate,
        });
    });

    socket.on('admin-end-live', async (payload = {}) => {
        if (socket.data.livestreamRole !== 'ADMIN') return;

        await endCurrentLivestreamService().catch(() => null);
        io.to(LIVESTREAM_USERS_ROOM).emit('admin-end-live', {
            livestreamId: payload.livestreamId || socket.data.livestreamId || '',
        });

        socket.leave(LIVESTREAM_ADMIN_ROOM);
        clearActiveLivestreamAdmin(socket.id);
        socket.data.livestreamRole = '';
        socket.data.livestreamId = '';
    });

    socket.on('user-disconnect', () => {
        if (socket.data.livestreamRole !== 'USER') return;

        io.to(LIVESTREAM_ADMIN_ROOM).emit('user-disconnect', {
            userSocketId: socket.id,
        });

        socket.leave(LIVESTREAM_USERS_ROOM);
        socket.data.livestreamRole = '';
    });

    socket.on('disconnect', async () => {
        connectedClients.delete(socket.id);

        if (socket.data.livestreamRole === 'ADMIN') {
            await endCurrentLivestreamService().catch(() => null);
            clearActiveLivestreamAdmin(socket.id);
            io.to(LIVESTREAM_USERS_ROOM).emit('admin-end-live', {
                livestreamId: socket.data.livestreamId || '',
            });
        }

        if (socket.data.livestreamRole === 'USER') {
            io.to(LIVESTREAM_ADMIN_ROOM).emit('user-disconnect', {
                userSocketId: socket.id,
            });
        }
    });
};
