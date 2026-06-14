import { Server } from 'socket.io';
import { registerLivestreamSocket } from '../sockets/livestream.socket';

let io = null;

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: [
                'http://localhost:5173',
                'http://127.0.0.1:5173',
                'http://localhost:5174',
                'http://127.0.0.1:5174',
                'http://localhost:3000',
                'http://127.0.0.1:3000'
            ],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] Client connected: ${socket.id}`);
        registerLivestreamSocket(io, socket);

        socket.on('join', (data) => {
            if (data?.userId) {
                socket.join(`user:${data.userId}`);
                console.log(`[Socket] Client ${socket.id} joined room: user:${data.userId}`);
            }
            if (data?.roleId) {
                socket.join(`role:${data.roleId}`);
                console.log(`[Socket] Client ${socket.id} joined room: role:${data.roleId}`);
            }
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] Client disconnected: ${socket.id}`);
        });
    });

    return io;
};

export const getIO = () => {
    return io;
};

export const sendSocketNotification = (recipientId, recipientRole, notificationData) => {
    if (!io) {
        console.warn('[Socket] Server not initialized. Cannot send notification.');
        return;
    }

    if (recipientId) {
        io.to(`user:${recipientId}`).emit('notification', notificationData);
        console.log(`[Socket] Emitted notification to user:${recipientId}`);
    } else if (recipientRole) {
        io.to(`role:${recipientRole}`).emit('notification', notificationData);
        console.log(`[Socket] Emitted notification to role:${recipientRole}`);
    } else {
        io.emit('notification', notificationData);
        console.log('[Socket] Broadcasted notification to all');
    }
};
