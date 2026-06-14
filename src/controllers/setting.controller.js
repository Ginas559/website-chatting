import { validationResult } from 'express-validator';
import { getSystemSettings, updateSystemSettings } from '../services/setting.service';

const ok = (res, message, data) => res.json({ success: true, message, data });

export const getSettingsController = async (req, res) => {
    try {
        const data = await getSystemSettings();
        return ok(res, 'Lấy cài đặt hệ thống thành công', data);
    } catch (error) {
        console.error('Get Settings Error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server khi lấy cài đặt hệ thống' });
    }
};

export const updateSettingsController = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ', errors: errors.array() });
    }

    try {
        const data = await updateSystemSettings(req.body, req.user?.id);
        return ok(res, 'Cập nhật cài đặt hệ thống thành công', data);
    } catch (error) {
        console.error('Update Settings Error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật cài đặt hệ thống' });
    }
};
