import Livestream from '../models/livestream.model';

const mapLivestream = (livestream) => {
    if (!livestream) return null;

    const doc = livestream.toObject ? livestream.toObject() : livestream;

    return {
        _id: doc._id,
        title: doc.title,
        description: doc.description,
        status: doc.status,
        startedAt: doc.startedAt,
        endedAt: doc.endedAt,
        createdBy: doc.createdBy,
    };
};

export const getCurrentLivestreamService = async () => {
    const livestream = await Livestream.findOne({ status: 'LIVE' }).sort({ startedAt: -1 }).lean();
    return mapLivestream(livestream);
};

export const startLivestreamService = async ({ title, description, createdBy }) => {
    const activeLivestream = await Livestream.findOne({ status: 'LIVE' }).lean();

    if (activeLivestream) {
        const error = new Error('Đang có livestream diễn ra');
        error.status = 409;
        throw error;
    }

    const livestream = await Livestream.create({
        title: String(title || '').trim(),
        description: String(description || '').trim(),
        status: 'LIVE',
        startedAt: new Date(),
        createdBy,
    });

    return mapLivestream(livestream);
};

export const endLivestreamService = async ({ id, endedBy }) => {
    const livestream = await Livestream.findOneAndUpdate(
        { _id: id, status: 'LIVE' },
        {
            $set: {
                status: 'ENDED',
                endedAt: new Date(),
                updatedBy: endedBy,
            },
        },
        { new: true }
    );

    if (!livestream) {
        const error = new Error('Không tìm thấy livestream đang diễn ra');
        error.status = 404;
        throw error;
    }

    return mapLivestream(livestream);
};

export const endCurrentLivestreamService = async () => {
    const livestream = await Livestream.findOneAndUpdate(
        { status: 'LIVE' },
        {
            $set: {
                status: 'ENDED',
                endedAt: new Date(),
            },
        },
        { new: true, sort: { startedAt: -1 } }
    );

    return mapLivestream(livestream);
};

export const endStaleLivestreamsService = async () => {
    const result = await Livestream.updateMany(
        { status: 'LIVE' },
        {
            $set: {
                status: 'ENDED',
                endedAt: new Date(),
            },
        }
    );

    return result.modifiedCount || 0;
};

export const getLivestreamHistoryService = async ({ page = 1, limit = 10 }) => {
    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const skip = (safePage - 1) * safeLimit;

    const [items, totalItems] = await Promise.all([
        Livestream.find({})
            .sort({ startedAt: -1 })
            .skip(skip)
            .limit(safeLimit)
            .populate('createdBy', 'email firstName lastName roleId')
            .lean(),
        Livestream.countDocuments({}),
    ]);

    return {
        items: items.map(mapLivestream),
        pagination: {
            page: safePage,
            limit: safeLimit,
            totalItems,
            totalPages: Math.ceil(totalItems / safeLimit),
        },
    };
};
