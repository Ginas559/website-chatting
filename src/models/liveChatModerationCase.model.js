import mongoose from 'mongoose';

const moderationCommentSchema = new mongoose.Schema(
    {
        content: { type: String, required: true },
        predictedLabel: { type: Number, required: true },
        labelName: { type: String, required: true },
        confidence: { type: Number, default: 0 },
        probabilities: {
            clean: { type: Number, default: 0 },
            offensive: { type: Number, default: 0 },
            hate: { type: Number, default: 0 },
        },
        source: { type: String, default: 'AI_MODEL' },
        createdAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const liveChatModerationCaseSchema = new mongoose.Schema(
    {
        liveId: { type: mongoose.Schema.Types.ObjectId, ref: 'Livestream', required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        displayName: { type: String, required: true },
        role: { type: String, required: true },
        violationType: {
            type: String,
            enum: ['LEVEL_2_SINGLE', 'THREE_LEVEL_1_IN_LIVE'],
            required: true,
        },
        comments: [moderationCommentSchema],
        banDays: { type: Number, required: true, min: 1 },
        banMultiplier: { type: Number, required: true, min: 1 },
        bannedUntil: { type: Date, required: true },
        isActive: { type: Boolean, default: true, index: true },
        status: {
            type: String,
            enum: ['ACTIVE', 'UNBANNED', 'EXPIRED'],
            default: 'ACTIVE',
            index: true,
        },
        createdBy: { type: String, default: 'AI_BOT' },
        unbannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        unbannedAt: { type: Date },
        unbanReason: { type: String },
    },
    { timestamps: true }
);

liveChatModerationCaseSchema.index({ userId: 1, createdAt: -1 });
liveChatModerationCaseSchema.index({ liveId: 1, userId: 1 });
liveChatModerationCaseSchema.index({ userId: 1, isActive: 1, bannedUntil: 1 });

const LiveChatModerationCase = mongoose.model('LiveChatModerationCase', liveChatModerationCaseSchema);

export default LiveChatModerationCase;
