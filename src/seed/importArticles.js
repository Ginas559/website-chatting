const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

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

    const filePath = path.resolve(__dirname, '../../../articles_import.json');
    if (!fs.existsSync(filePath)) {
      console.error('articles_import.json not found at', filePath);
      process.exit(1);
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const docs = JSON.parse(raw);

    if (!Array.isArray(docs) || !docs.length) {
      console.error('No articles found in JSON file.');
      process.exit(1);
    }

    // Ensure timestamps
    const prepared = docs.map((d) => ({ ...d, createdAt: new Date(), updatedAt: new Date() }));

    const result = await mongoose.connection.collection('articles').insertMany(prepared, { ordered: false });
    console.log(`Inserted ${result.insertedCount} article(s).`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error importing articles:', err);
    process.exit(2);
  }
};

run();
