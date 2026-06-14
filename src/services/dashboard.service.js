import Order from '../models/order.model';
import Product from '../models/product.model';
import User from '../models/user';

const PROCESSING_STATUSES = ['CONFIRMED', 'PREPARING'];
const REVENUE_STATUSES = ['PAID', 'DELIVERED'];

const startOfDay = (date) => {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
};

const formatDateKey = (date) => date.toISOString().slice(0, 10);

export const getDashboardOverview = async () => {
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
    ] = await Promise.all([
        Order.aggregate([
            { $match: { $or: [{ status: 'DELIVERED' }, { paymentStatus: 'PAID' }] } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
        Order.countDocuments(),
        Order.countDocuments({ status: 'NEW' }),
        Order.countDocuments({ status: { $in: PROCESSING_STATUSES } }),
        Order.countDocuments({ status: 'SHIPPING' }),
        Order.countDocuments({ status: 'DELIVERED' }),
        Order.countDocuments({ status: 'CANCELLED' }),
        Product.countDocuments({ isDeleted: { $ne: true } }),
        Product.countDocuments({ isDeleted: { $ne: true }, stock: { $lte: 5 } }),
        User.countDocuments({ roleId: 'R2' }),
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
    };
};

export const getRevenueSeries = async () => {
    const today = startOfDay(new Date());
    const from = new Date(today);
    from.setDate(from.getDate() - 6);

    const rows = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: from },
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

    const map = new Map(rows.map((item) => [item._id, item.revenue]));
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(from);
        date.setDate(from.getDate() + index);
        const key = formatDateKey(date);
        return { date: key, revenue: map.get(key) || 0 };
    });
};

export const getOrderStatusStats = async () => {
    const rows = await Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);
    return rows.map((item) => ({ status: item._id, count: item.count }));
};

export const getTopProducts = async () => {
    return Order.aggregate([
        { $match: { status: { $ne: 'CANCELLED' } } },
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
        { $limit: 5 },
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

export const getRecentOrders = async () => {
    const orders = await Order.find()
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
