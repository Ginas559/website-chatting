import {
    createUnbanRequest,
    getMyModerationBans,
    listModerationBans,
    listUnbanRequests,
    reviewUnbanRequest,
    unbanModerationCase,
} from '../services/liveChatModeration.service';

const ok = (res, message, data) => res.json({ success: true, message, data });

const fail = (res, error, fallback) => {
    return res.status(error?.status || 500).json({
        success: false,
        message: error?.message || fallback,
    });
};

export const listBansController = async (req, res) => {
    try {
        return ok(res, 'Lấy danh sách án phạt live chat thành công', await listModerationBans(req.query || {}));
    } catch (error) {
        return fail(res, error, 'Không thể lấy danh sách án phạt');
    }
};

export const unbanController = async (req, res) => {
    try {
        const data = await unbanModerationCase({
            caseId: req.params.caseId,
            currentUserId: req.user?.id,
            reason: req.body?.reason,
        });
        return ok(res, 'Gỡ ban chat thành công', data);
    } catch (error) {
        return fail(res, error, 'Không thể gỡ ban chat');
    }
};

export const myBansController = async (req, res) => {
    try {
        return ok(res, 'Lấy án phạt live chat của bạn thành công', await getMyModerationBans(req.user?.id));
    } catch (error) {
        return fail(res, error, 'Không thể lấy án phạt live chat của bạn');
    }
};

export const createUnbanRequestController = async (req, res) => {
    try {
        const data = await createUnbanRequest({
            caseId: req.params.caseId,
            userId: req.user?.id,
            reason: req.body?.reason,
        });
        return ok(res, 'Gửi yêu cầu gỡ ban thành công', data);
    } catch (error) {
        return fail(res, error, 'Không thể gửi yêu cầu gỡ ban');
    }
};

export const listUnbanRequestsController = async (req, res) => {
    try {
        return ok(res, 'Lấy danh sách yêu cầu gỡ ban thành công', await listUnbanRequests(req.query || {}));
    } catch (error) {
        return fail(res, error, 'Không thể lấy danh sách yêu cầu gỡ ban');
    }
};

export const reviewUnbanRequestController = async (req, res) => {
    try {
        const data = await reviewUnbanRequest({
            requestId: req.params.requestId,
            status: req.body?.status,
            adminReply: req.body?.adminReply,
            currentUserId: req.user?.id,
        });
        return ok(res, 'Xử lý yêu cầu gỡ ban thành công', data);
    } catch (error) {
        return fail(res, error, 'Không thể xử lý yêu cầu gỡ ban');
    }
};
