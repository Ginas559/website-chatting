import mongoose from 'mongoose';

const levelOneCommentSchema = new mongoose.Schema(
    {
        content: { type: String, required: true },
        predictedLabel: { type: Number, required: true },
        labelName: { type: String, required: true },
        confidence: { type: Number, default: 0 },
        probabilities: { type: Object, default: {} },
        source: { type: String, default: 'AI_MODEL' },
        createdAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const liveChatLevelOneBufferSchema = new mongoose.Schema(
    {
        liveId: { type: mongoose.Schema.Types.ObjectId, ref: 'Livestream', required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        comments: [levelOneCommentSchema],
    },
    { timestamps: true }
);

liveChatLevelOneBufferSchema.index({ liveId: 1, userId: 1 }, { unique: true });

const LiveChatLevelOneBuffer = mongoose.model('LiveChatLevelOneBuffer', liveChatLevelOneBufferSchema);

export default LiveChatLevelOneBuffer;
