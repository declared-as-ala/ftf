import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import connectDB from '../lib/db';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function run() {
  console.log('Connecting to database...');
  await connectDB();
  console.log('Connected!');

  const db = mongoose.connection.db;
  if (!db) {
    console.error('No database object available!');
    return;
  }

  console.log('Listing collections...');
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  console.log('Collections:', collections.map(c => c.name));

  console.log('Testing write/delete...');
  const testColl = db.collection('test_temp');
  console.log('Inserting dummy document...');
  const insertResult = await testColl.insertOne({ test: true, date: new Date() });
  console.log('Insert result:', insertResult);

  console.log('Deleting dummy document...');
  const deleteResult = await testColl.deleteMany({});
  console.log('Delete result:', deleteResult);

  console.log('Success!');
}

run()
  .catch(err => console.error('Error:', err))
  .finally(() => mongoose.disconnect());
