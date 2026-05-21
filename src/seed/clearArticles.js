const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGO_DB_URL || process.env.MONGO_URI;

if (!uri) {
  console.error('Please set MONGO_DB_URL or MONGO_URI in your environment (.env) before running this script.');
  process.exit(1);
}

const run = async () => {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB.');

    const result = await mongoose.connection.collection('articles').deleteMany({});
    console.log(`Deleted ${result.deletedCount} article(s).`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error clearing articles:', err);
    process.exit(2);
  }
};

run();
