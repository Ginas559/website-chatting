let ioInstance = null;

export const registerChatSocket = (io, socket) => {
    ioInstance = io;

    socket.on('join_chat', (data) => {
        if (data?.userId) {
            // Client joins room formatted with a colon: "chat:<userId>"
            socket.join(`chat:${data.userId}`);
            console.log(`[Chat Socket] Client ${socket.id} joined room: chat:${data.userId}`);
        }
    });
};

export const sendSocketChatMessage = (senderId, receiverId, message) => {
    if (!ioInstance) {
        console.warn('[Chat Socket] Socket server not initialized');
        return;
    }

    // Fix Bug 2: Correct socket room format from "chat_" to "chat:" to match client subscription
    const targetRoom = `chat:${receiverId}`;
    ioInstance.to(targetRoom).emit('chat_message', message);
    console.log(`[Chat Socket] Emitted message to room: ${targetRoom}`);
};
