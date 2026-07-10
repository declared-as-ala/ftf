import mongoose from 'mongoose';

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Copy .env.example to .env.local and set your MongoDB connection string.'
    );
  }
  return uri;
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache;
}

let cached: MongooseCache = (globalThis as any).mongoose || {
  conn: null,
  promise: null,
};

if (!(globalThis as any).mongoose) {
  (globalThis as any).mongoose = cached;
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      // Force IPv4 : évite les timeouts NAT64/IPv6 observés sur certains réseaux
      // (MongoNetworkError « ENETUNREACH 64:ff9b:: » puis ETIMEDOUT IPv4)
      family: 4,
      // Échouer vite plutôt que bloquer les requêtes ~30 s quand Atlas est injoignable
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
    };

    const uri = getMongoUri();
    cached.promise = mongoose.connect(uri, opts).then((mongoose) => {
      console.log('✅ MongoDB connected');
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;

