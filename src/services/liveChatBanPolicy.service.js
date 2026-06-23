import LiveChatModerationCase from '../models/liveChatModerationCase.model';

export const getCurrentMonthRange = (date = new Date()) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
    return { start, end };
};

export const calculateNextBanDays = async ({ userId, now = new Date() }) => {
    const { start, end } = getCurrentMonthRange(now);
    const previousCase = await LiveChatModerationCase.findOne({
        userId,
        createdBy: 'AI_BOT',
        createdAt: { $gte: start, $lt: end },
    })
        .sort({ createdAt: -1 })
        .lean();

    if (!previousCase) {
        return { banDays: 1, banMultiplier: 1 };
    }

    return {
        banDays: Math.max(Number(previousCase.banDays || 1) * 2, 1),
        banMultiplier: Math.max(Number(previousCase.banMultiplier || 1) * 2, 1),
    };
};

export const createBanCase = async ({ liveId, user, violationType, comments }) => {
    const now = new Date();
    const { banDays, banMultiplier } = await calculateNextBanDays({ userId: user._id, now });
    const bannedUntil = new Date(now.getTime() + banDays * 24 * 60 * 60 * 1000);

    return LiveChatModerationCase.create({
        liveId,
        userId: user._id,
        displayName: user.displayName,
        role: user.role,
        violationType,
        comments,
        banDays,
        banMultiplier,
        bannedUntil,
        isActive: true,
        status: 'ACTIVE',
        createdBy: 'AI_BOT',
    });
};
