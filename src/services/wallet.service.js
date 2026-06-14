import WalletTransaction from '../models/walletTransaction.model';

export const recordDeliveredOrderRevenue = async (order) => {
    if (!order || order.status !== 'DELIVERED' || order.paymentStatus !== 'PAID') {
        return null;
    }

    return WalletTransaction.findOneAndUpdate(
        { order: order._id },
        {
            $setOnInsert: {
                order: order._id,
                orderCode: order.orderCode,
                type: 'ORDER_REVENUE',
                amount: Number(order.totalAmount || 0),
                status: 'AVAILABLE',
                availableAt: new Date(),
                note: 'Tiền đơn hàng đã giao được ghi nhận vào ví hệ thống',
            },
        },
        { new: true, upsert: true }
    );
};
