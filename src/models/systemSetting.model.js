import mongoose from 'mongoose';

const systemSettingSchema = new mongoose.Schema(
    {
        shopName: { type: String, required: true, trim: true },
        supportEmail: { type: String, required: true, trim: true, lowercase: true },
        supportPhone: { type: String, required: true, trim: true },
        shopAddress: { type: String, default: '', trim: true },
        defaultShippingFee: { type: Number, default: 0, min: 0 },
        cancelOrderLimitMinutes: { type: Number, default: 30, min: 0 },
        lowStockThreshold: { type: Number, default: 5, min: 0 },
        maintenanceMode: { type: Boolean, default: false },
        maintenanceMessage: { type: String, default: 'Hệ thống đang bảo trì', trim: true },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);

export default SystemSetting;
