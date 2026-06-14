import SystemSetting from '../models/systemSetting.model';

const DEFAULT_SETTINGS = {
    shopName: 'SmartZone Store',
    supportEmail: 'support@smartzone.vn',
    supportPhone: '0900000000',
    shopAddress: 'TP.HCM',
    defaultShippingFee: 30000,
    cancelOrderLimitMinutes: 30,
    lowStockThreshold: 5,
    maintenanceMode: false,
    maintenanceMessage: 'Hệ thống đang bảo trì',
};

const mapSettings = (settings) => ({
    shopName: settings.shopName,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    shopAddress: settings.shopAddress,
    defaultShippingFee: settings.defaultShippingFee,
    cancelOrderLimitMinutes: settings.cancelOrderLimitMinutes,
    lowStockThreshold: settings.lowStockThreshold,
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage,
    updatedAt: settings.updatedAt,
});

export const getSystemSettings = async () => {
    let settings = await SystemSetting.findOne();

    if (!settings) {
        settings = await SystemSetting.create(DEFAULT_SETTINGS);
    }

    return mapSettings(settings);
};

export const updateSystemSettings = async (payload = {}, actorId) => {
    const current = await getSystemSettings();
    const update = {
        ...current,
        ...payload,
        updatedBy: actorId,
    };

    const settings = await SystemSetting.findOneAndUpdate({}, update, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
    });

    return mapSettings(settings);
};
