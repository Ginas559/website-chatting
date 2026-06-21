import mongoose from 'mongoose';

const liveChatUnbanRequestSchema = new mongoose.Schema(
    {
        moderationCaseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'LiveChatModerationCase',
            required: true,
            index: true,
        },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        reason: { type: String, required: true, trim: true, maxlength: 500 },
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'REJECTED'],
            default: 'PENDING',
            index: true,
        },
        adminReply: { type: String, trim: true, maxlength: 500 },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reviewedAt: { type: Date },
    },
    { timestamps: true }
);

liveChatUnbanRequestSchema.index(
    { moderationCaseId: 1, userId: 1, status: 1 },
    { unique: true, partialFilterExpression: { status: 'PENDING' } }
);

const LiveChatUnbanRequest = mongoose.model('LiveChatUnbanRequest', liveChatUnbanRequestSchema);

export default LiveChatUnbanRequest;
