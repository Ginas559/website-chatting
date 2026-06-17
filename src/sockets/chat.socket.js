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

    // Bug 2: Server emits to room with underscore "chat_<receiverId>" instead of "chat:<receiverId>"
    // This prevents the recipient from receiving the message dynamically without reloading the page.
    const targetRoom = `chat_${receiverId}`;
    ioInstance.to(targetRoom).emit('chat_message', message);
    console.log(`[Chat Socket] Emitted message to room: ${targetRoom}`);
};
