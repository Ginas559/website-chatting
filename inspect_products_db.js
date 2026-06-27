import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_DB_URL = process.env.MONGO_DB_URL;

if (!MONGO_DB_URL) {
    console.error('MONGO_DB_URL not found in .env file!');
    process.exit(1);
}

const cartSnapshotSchema = new mongoose.Schema({
    name: String,
    image: String,
    price: Number,
    brand: String,
    color: String,
    capacity: String,
}, { _id: false });

const cartItemSchema = new mongoose.Schema({
    product: mongoose.Schema.Types.ObjectId,
    quantity: Number,
    snapshot: cartSnapshotSchema,
});

const cartSchema = new mongoose.Schema({
    user: mongoose.Schema.Types.ObjectId,
    items: [cartItemSchema],
});

const Cart = mongoose.model('Cart', cartSchema);

async function inspect() {
    try {
        await mongoose.connect(MONGO_DB_URL);
        console.log('Connected to MongoDB successfully!');
        const carts = await Cart.find({}).populate('items.product', 'name price');
        console.log('--- CARTS IN DB ---');
        carts.forEach(c => {
            console.log(`User: ${c.user}`);
            c.items.forEach(item => {
                console.log(`  - Product ID: ${item.product} | Snapshot Name: "${item.snapshot?.name}" | Quantity: ${item.quantity}`);
            });
        });
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error during connection/inspection:', error);
    }
}

inspect();
