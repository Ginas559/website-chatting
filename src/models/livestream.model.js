import mongoose from 'mongoose';

const livestreamSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, default: '', trim: true },
        status: {
            type: String,
            enum: ['LIVE', 'ENDED'],
            default: 'LIVE',
            index: true,
        },
        startedAt: { type: Date, default: Date.now },
        endedAt: { type: Date, default: null },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    { timestamps: true }
);

const Livestream = mongoose.model('Livestream', livestreamSchema);

export default Livestream;
