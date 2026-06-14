import { validationResult } from 'express-validator';
import {
    endLivestreamService,
    getCurrentLivestreamService,
    getLivestreamHistoryService,
    startLivestreamService,
} from '../services/livestream.service';
import { hasActiveLivestreamAdmin } from '../sockets/livestream.state';

const ok = (res, { message, data, status = 200 }) => {
    return res.status(status).json({
        success: true,
        message,
        data,
    });
};

const fail = (res, error, fallback = 'Có lỗi xảy ra') => {
    const status = error?.status || 500;

    return res.status(status).json({
        success: false,
        message: error?.message || fallback,
    });
};

export const getCurrentLivestreamController = async (req, res) => {
    try {
        const livestream = await getCurrentLivestreamService();
        const activeLivestream = livestream && hasActiveLivestreamAdmin(livestream._id) ? livestream : null;

        return ok(res, {
            message: activeLivestream ? 'Lấy livestream hiện tại thành công' : 'Hiện chưa có livestream',
            data: activeLivestream,
        });
    } catch (error) {
        return fail(res, error, 'Không thể lấy livestream hiện tại');
    }
};

export const startLivestreamController = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: errors.array()[0]?.msg || 'Dữ liệu không hợp lệ',
                errors: errors.array(),
            });
        }

        const livestream = await startLivestreamService({
            title: req.body.title,
            description: req.body.description,
            createdBy: req.user.id,
        });

        return ok(res, {
            message: 'Bắt đầu livestream thành công',
            data: livestream,
            status: 201,
        });
    } catch (error) {
        return fail(res, error, 'Không thể bắt đầu livestream');
    }
};

export const endLivestreamController = async (req, res) => {
    try {
        const livestream = await endLivestreamService({
            id: req.params.id,
            endedBy: req.user.id,
        });

        return ok(res, {
            message: 'Kết thúc livestream thành công',
            data: livestream,
        });
    } catch (error) {
        return fail(res, error, 'Không thể kết thúc livestream');
    }
};

export const getLivestreamHistoryController = async (req, res) => {
    try {
        const result = await getLivestreamHistoryService(req.query || {});

        return ok(res, {
            message: 'Lấy lịch sử livestream thành công',
            data: result,
        });
    } catch (error) {
        return fail(res, error, 'Không thể lấy lịch sử livestream');
    }
};
