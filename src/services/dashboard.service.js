import Order from '../models/order.model';
import Product from '../models/product.model';
import User from '../models/user';
import WalletTransaction from '../models/walletTransaction.model';

const PROCESSING_STATUSES = ['CONFIRMED', 'PREPARING'];

const startOfDay = (date) => {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
};

const endOfDay = (date) => {
    const value = new Date(date);
    value.setHours(23, 59, 59, 999);
    return value;
};

const formatDateKey = (date) => date.toISOString().slice(0, 10);

const getDateRange = ({ range = '7days', startDate, endDate } = {}) => {
    const today = startOfDay(new Date());
    let from = new Date(today);
    let to = endOfDay(today);

    if (range === '30days') {
        from.setDate(from.getDate() - 29);
    } else if (range === 'thisMonth') {
        from = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (range === 'custom' && startDate && endDate) {
        from = startOfDay(startDate);
        to = endOfDay(endDate);
    } else {
        from.setDate(from.getDate() - 6);
    }

    return { from, to };
};

const makeCreatedAtFilter = (rangeQuery) => {
    const { from, to } = getDateRange(rangeQuery);
    return { createdAt: { $gte: from, $lte: to } };
};

const fillDailySeries = ({ rows, from, to, valueKey }) => {
    const map = new Map(rows.map((item) => [item._id, item[valueKey] || 0]));
    const result = [];
    const cursor = new Date(from);

    while (cursor <= to) {
        const key = formatDateKey(cursor);
        result.push({ date: key, [valueKey]: map.get(key) || 0 });
        cursor.setDate(cursor.getDate() + 1);
    }

    return result;
};

export const getDashboardOverview = async (rangeQuery = {}) => {
    const dateFilter = makeCreatedAtFilter(rangeQuery);
    const [
        revenueAgg,
        totalOrders,
        newOrders,
        processingOrders,
        shippingOrders,
        completedOrders,
        cancelledOrders,
        totalProducts,
        lowStockProducts,
        totalUsers,
        newCustomers,
    ] = await Promise.all([
        Order.aggregate([
            { $match: { ...dateFilter, $or: [{ status: 'DELIVERED' }, { paymentStatus: 'PAID' }] } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
        Order.countDocuments(dateFilter),
        Order.countDocuments({ ...dateFilter, status: 'NEW' }),
        Order.countDocuments({ ...dateFilter, status: { $in: PROCESSING_STATUSES } }),
        Order.countDocuments({ ...dateFilter, status: 'SHIPPING' }),
        Order.countDocuments({ ...dateFilter, status: 'DELIVERED' }),
        Order.countDocuments({ ...dateFilter, status: 'CANCELLED' }),
        Product.countDocuments({ isDeleted: { $ne: true } }),
        Product.countDocuments({ isDeleted: { $ne: true }, stock: { $lte: 5 } }),
        User.countDocuments({ roleId: 'R2' }),
        User.countDocuments({ roleId: 'R2', ...dateFilter }),
    ]);

    return {
        totalRevenue: revenueAgg[0]?.total || 0,
        totalOrders,
        newOrders,
        processingOrders,
        shippingOrders,
        completedOrders,
        cancelledOrders,
        totalProducts,
        lowStockProducts,
        totalUsers,
        newCustomers,
    };
};

export const getRevenueSeries = async (rangeQuery = {}) => {
    const { from, to } = getDateRange(rangeQuery);

    const rows = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: from, $lte: to },
                $or: [{ status: 'DELIVERED' }, { paymentStatus: 'PAID' }],
            },
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                revenue: { $sum: '$totalAmount' },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    return fillDailySeries({ rows, from, to, valueKey: 'revenue' });
};

export const getOrderStatusStats = async (rangeQuery = {}) => {
    const rows = await Order.aggregate([
        { $match: makeCreatedAtFilter(rangeQuery) },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);
    return rows.map((item) => ({ status: item._id, count: item.count }));
};

export const getTopProducts = async (rangeQuery = {}) => {
    return Order.aggregate([
        { $match: { ...makeCreatedAtFilter(rangeQuery), status: { $ne: 'CANCELLED' } } },
        { $unwind: '$items' },
        {
            $group: {
                _id: '$items.product',
                name: { $first: '$items.snapshot.name' },
                image: { $first: '$items.snapshot.image' },
                soldQuantity: { $sum: '$items.quantity' },
                revenue: { $sum: '$items.lineTotal' },
            },
        },
        { $sort: { soldQuantity: -1, revenue: -1 } },
        { $limit: 10 },
        {
            $project: {
                _id: 0,
                productId: '$_id',
                name: 1,
                image: 1,
                soldQuantity: 1,
                revenue: 1,
            },
        },
    ]);
};

export const getRecentOrders = async (rangeQuery = {}) => {
    const orders = await Order.find(makeCreatedAtFilter(rangeQuery))
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('user', 'firstName lastName email')
        .select('orderCode user totalAmount status createdAt')
        .lean();

    return orders.map((order) => ({
        _id: order._id,
        orderCode: order.orderCode,
        customerName: `${order.user?.firstName || ''} ${order.user?.lastName || ''}`.trim() || order.user?.email || 'Khách hàng',
        totalAmount: order.totalAmount,
        status: order.status,
        createdAt: order.createdAt,
    }));
};

export const getNewCustomerSeries = async (rangeQuery = {}) => {
    const { from, to } = getDateRange(rangeQuery);
    const rows = await User.aggregate([
        { $match: { roleId: 'R2', createdAt: { $gte: from, $lte: to } } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                customers: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    return fillDailySeries({ rows, from, to, valueKey: 'customers' });
};

export const getCashflowStats = async (rangeQuery = {}) => {
    const dateFilter = makeCreatedAtFilter(rangeQuery);
    const [shippingAgg, deliveredAgg, walletAgg, recentTransactions] = await Promise.all([
        Order.aggregate([
            { $match: { ...dateFilter, status: 'SHIPPING' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
        ]),
        Order.aggregate([
            { $match: { ...dateFilter, status: 'DELIVERED', paymentStatus: 'PAID' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
        ]),
        WalletTransaction.aggregate([
            { $match: { ...dateFilter, status: 'AVAILABLE' } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        WalletTransaction.find(dateFilter)
            .sort({ createdAt: -1 })
            .limit(8)
            .lean(),
    ]);

    return {
        shippingAmount: shippingAgg[0]?.total || 0,
        shippingOrders: shippingAgg[0]?.count || 0,
        deliveredAmount: deliveredAgg[0]?.total || 0,
        deliveredOrders: deliveredAgg[0]?.count || 0,
        walletBalance: walletAgg[0]?.total || 0,
        walletTransactions: walletAgg[0]?.count || 0,
        recentTransactions: recentTransactions.map((item) => ({
            _id: item._id,
            orderCode: item.orderCode,
            amount: item.amount,
            status: item.status,
            createdAt: item.createdAt,
            note: item.note,
        })),
    };
};
