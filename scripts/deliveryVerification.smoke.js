import assert from 'assert/strict';
import mongoose from 'mongoose';
import Order from '../src/models/order.model.js';
import '../src/models/user.js';
import {
    createAdminDeliveryQr,
    getAdminDeliveryQr,
    getAdminOrderDetail,
    verifyMyDeliveryQr,
} from '../src/services/order.service.js';

require('dotenv').config();

const expectServiceError = async (action, expectedCode) => {
    try {
        await action();
        assert.fail(`Expected service error ${expectedCode}`);
    } catch (error) {
        assert.equal(error.code, expectedCode);
    }
};

const run = async () => {
    const mongoUri = process.env.MONGO_DB_URL || process.env.MONGO_URI;
    assert.ok(mongoUri, 'Missing MongoDB connection string');

    const userId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();
    const productId = new mongoose.Types.ObjectId();
    const orderCode = `QRTEST${Date.now()}`;
    let orderId = null;

    await mongoose.connect(mongoUri);

    try {
        const order = await Order.create({
            orderCode,
            user: userId,
            items: [{
                product: productId,
                quantity: 2,
                unitPrice: 150000,
                lineTotal: 300000,
                snapshot: {
                    name: 'QR smoke test product',
                    slug: 'qr-smoke-test-product',
                    image: 'https://example.com/qr-smoke-test.png',
                    price: 150000,
                    brand: 'SmartZone',
                    category: 'Test',
                },
            }],
            shippingInfo: {
                fullName: 'QR Test User',
                phone: '0912345678',
                address: 'Temporary integration test address',
                city: 'Ho Chi Minh City',
            },
            subtotal: 300000,
            shippingFee: 0,
            totalAmount: 300000,
            paymentMethod: 'COD',
            paymentStatus: 'UNPAID',
            status: 'SHIPPING',
            statusHistory: [{
                status: 'SHIPPING',
                note: 'Temporary QR integration test',
                changedAt: new Date(),
            }],
        });
        orderId = order._id;

        const firstQr = await createAdminDeliveryQr({ orderIdOrCode: orderCode });
        assert.match(firstQr.qrContent, /^SZD1\.[a-f0-9]{64}$/);
        assert.equal(firstQr.status, 'ACTIVE');

        const activeAdminDetail = await getAdminOrderDetail({ orderIdOrCode: orderCode });
        assert.equal(activeAdminDetail.deliveryQr.status, 'ACTIVE');

        const storedOrder = await Order.findById(orderId)
            .select('+deliveryVerification.tokenHash +deliveryVerification.encryptedToken')
            .lean();
        assert.equal(storedOrder.deliveryVerification.tokenHash.length, 64);
        assert.ok(storedOrder.deliveryVerification.encryptedToken);
        assert.equal(JSON.stringify(storedOrder).includes(firstQr.qrContent), false);

        const restoredQr = await getAdminDeliveryQr({ orderIdOrCode: orderCode });
        assert.equal(restoredQr.qrContent, firstQr.qrContent);

        const verified = await verifyMyDeliveryQr({ userId, qrContent: firstQr.qrContent });
        assert.equal(verified.verificationLevel, 'VERIFIED');
        assert.equal(verified.order.items.length, 1);
        assert.equal(verified.order.shippingInfo.maskedPhone, '*******678');

        await expectServiceError(
            () => verifyMyDeliveryQr({ userId: otherUserId, qrContent: firstQr.qrContent }),
            'DELIVERY_QR_OWNER_MISMATCH'
        );

        const secondQr = await createAdminDeliveryQr({ orderIdOrCode: orderCode });
        assert.equal(secondQr.qrContent, firstQr.qrContent);
        const verifiedAgain = await verifyMyDeliveryQr({ userId, qrContent: firstQr.qrContent });
        assert.equal(verifiedAgain.verificationLevel, 'VERIFIED');

        await Order.updateOne({ _id: orderId }, { $set: { status: 'DELIVERED' } });
        const deliveredResult = await verifyMyDeliveryQr({ userId, qrContent: firstQr.qrContent });
        assert.equal(deliveredResult.verificationLevel, 'REVIEW');

        const deliveredQr = await createAdminDeliveryQr({ orderIdOrCode: orderCode });
        assert.equal(deliveredQr.qrContent, firstQr.qrContent);
        const deliveredNewQrResult = await verifyMyDeliveryQr({ userId, qrContent: deliveredQr.qrContent });
        assert.equal(deliveredNewQrResult.verificationLevel, 'REVIEW');

        await Order.updateOne({ _id: orderId }, { $set: { status: 'PREPARING' } });
        await expectServiceError(
            () => verifyMyDeliveryQr({ userId, qrContent: deliveredQr.qrContent }),
            'DELIVERY_ORDER_STATUS_MISMATCH'
        );

        await Order.updateOne({
            _id: orderId,
        }, {
            $set: {
                status: 'SHIPPING',
                'deliveryVerification.expiresAt': new Date(Date.now() - 1000),
            },
        });
        await expectServiceError(
            () => verifyMyDeliveryQr({ userId, qrContent: deliveredQr.qrContent }),
            'DELIVERY_QR_EXPIRED'
        );

        const expiredAdminDetail = await getAdminOrderDetail({ orderIdOrCode: orderCode });
        assert.equal(expiredAdminDetail.deliveryQr.status, 'EXPIRED');

        await expectServiceError(
            () => verifyMyDeliveryQr({ userId, qrContent: 'https://fake.example/qr' }),
            'INVALID_DELIVERY_QR'
        );

        console.log('Delivery QR smoke test passed.');
    } finally {
        if (orderId) {
            await Order.deleteOne({ _id: orderId });
        }
        await mongoose.disconnect();
    }
};

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
