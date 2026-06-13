import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },
        recipientRole: {
            type: String,
            default: null,
            index: true,
        },
        type: {
            type: String,
            required: true,
            enum: ['NEW_ORDER', 'ORDER_STATUS_UPDATE', 'NEW_REVIEW', 'NEW_ARTICLE', 'NEW_EVENT'],
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        content: {
            type: String,
            required: true,
            trim: true,
        },
        link: {
            type: String,
            default: '',
            trim: true,
        },
        isRead: {
            type: Boolean,
            default: false,
            index: true,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for queries like "get notifications for a user by role or ID ordered by date"
notificationSchema.index({ recipient: 1, recipientRole: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
