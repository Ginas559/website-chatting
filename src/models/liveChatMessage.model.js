import mongoose from 'mongoose';

const liveChatMessageSchema = new mongoose.Schema(
    {
        liveId: { type: mongoose.Schema.Types.ObjectId, ref: 'Livestream', required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        displayName: { type: String, required: true, trim: true },
        role: {
            type: String,
            enum: ['ADMIN', 'MANAGER', 'USER', 'SHIPPER'],
            required: true,
        },
        content: { type: String, required: true, trim: true, maxlength: 200 },
        color: { type: String, required: true, trim: true },
        isPinned: { type: Boolean, default: false },
        isDeleted: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
    },
    { timestamps: false }
);

liveChatMessageSchema.index({ liveId: 1, createdAt: -1 });

const LiveChatMessage = mongoose.model('LiveChatMessage', liveChatMessageSchema);

export default LiveChatMessage;
