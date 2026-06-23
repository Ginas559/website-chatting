import { getRecentMessages } from '../services/liveChat.service';

const ok = (res, message, data) => res.json({ success: true, message, data });

const fail = (res, error, fallback) => {
    return res.status(error?.status || 500).json({
        success: false,
        message: error?.message || fallback,
    });
};

export const getRecentMessagesController = async (req, res) => {
    try {
        const messages = await getRecentMessages(req.params.liveId, req.query.limit || 50);
        return ok(res, 'Lấy lịch sử chat thành công', messages);
    } catch (error) {
        return fail(res, error, 'Không thể lấy lịch sử chat');
    }
};
