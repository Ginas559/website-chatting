import mongoose from 'mongoose';
import Order from '../src/models/order.model.js';

require('dotenv').config();

const run = async () => {
    const mongoUri = process.env.MONGO_DB_URL || process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error('Missing MongoDB connection string');
    }

    await mongoose.connect(mongoUri);

    try {
        const result = await Order.updateMany(
            {
                'deliveryVerification.tokenHash': { $nin: ['', null] },
                $or: [
                    { 'deliveryVerification.encryptedToken': { $exists: false } },
                    { 'deliveryVerification.encryptedToken': '' },
                ],
            },
            {
                $unset: {
                    deliveryVerification: 1,
                },
            }
        );

        console.log(`Migrated ${result.modifiedCount} legacy delivery QR record(s).`);
    } finally {
        await mongoose.disconnect();
    }
};

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
