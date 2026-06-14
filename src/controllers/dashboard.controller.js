import {
    getCashflowStats,
    getDashboardOverview,
    getNewCustomerSeries,
    getOrderStatusStats,
    getRecentOrders,
    getRevenueSeries,
    getTopProducts,
} from '../services/dashboard.service';

const ok = (res, message, data) => res.json({ success: true, message, data });
const fail = (res, error, message) => {
    console.error(message, error);
    return res.status(500).json({ success: false, message });
};

export const getOverviewController = async (req, res) => {
    try {
        return ok(res, 'Lấy tổng quan dashboard thành công', await getDashboardOverview(req.query || {}));
    } catch (error) {
        return fail(res, error, 'Lỗi server khi lấy tổng quan dashboard');
    }
};

export const getRevenueController = async (req, res) => {
    try {
        return ok(res, 'Lấy doanh thu dashboard thành công', await getRevenueSeries(req.query || {}));
    } catch (error) {
        return fail(res, error, 'Lỗi server khi lấy doanh thu dashboard');
    }
};

export const getOrderStatusController = async (req, res) => {
    try {
        return ok(res, 'Lấy thống kê trạng thái đơn hàng thành công', await getOrderStatusStats(req.query || {}));
    } catch (error) {
        return fail(res, error, 'Lỗi server khi lấy thống kê trạng thái đơn hàng');
    }
};

export const getTopProductsController = async (req, res) => {
    try {
        return ok(res, 'Lấy top sản phẩm thành công', await getTopProducts(req.query || {}));
    } catch (error) {
        return fail(res, error, 'Lỗi server khi lấy top sản phẩm');
    }
};

export const getRecentOrdersController = async (req, res) => {
    try {
        return ok(res, 'Lấy đơn hàng mới nhất thành công', await getRecentOrders(req.query || {}));
    } catch (error) {
        return fail(res, error, 'Lỗi server khi lấy đơn hàng mới nhất');
    }
};

export const getNewCustomersController = async (req, res) => {
    try {
        return ok(res, 'Lấy thống kê khách hàng mới thành công', await getNewCustomerSeries(req.query || {}));
    } catch (error) {
        return fail(res, error, 'Lỗi server khi lấy thống kê khách hàng mới');
    }
};

export const getCashflowController = async (req, res) => {
    try {
        return ok(res, 'Lấy thống kê dòng tiền thành công', await getCashflowStats(req.query || {}));
    } catch (error) {
        return fail(res, error, 'Lỗi server khi lấy thống kê dòng tiền');
    }
};
