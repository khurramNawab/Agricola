const mongoose = require('mongoose');

const connectDB = async (retries = 5, delayMs = 3000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 8000,
      });

      console.log(`MongoDB Connected: ${conn.connection.host}`);
      
      // Set up mongoose event listeners
      mongoose.connection.on('connected', () => {
        console.log('Mongoose connected to MongoDB');
      });

      mongoose.connection.on('error', (err) => {
        console.error('Mongoose connection error:', err?.message || err);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('Mongoose disconnected');
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('MongoDB connection closed due to app termination');
        process.exit(0);
      });

      return conn;
    } catch (error) {
      console.error(`MongoDB connection attempt ${attempt}/${retries} failed:`, error.message);
      if (attempt < retries) {
        console.log(`Retrying in ${delayMs / 1000}s...`);
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        console.error('Database connection failed after multiple attempts: Make sure your current IP address is whitelisted on MongoDB Atlas (Network Access -> Add 0.0.0.0/0).');
        process.exit(1);
      }
    }
  }
};

module.exports = connectDB;