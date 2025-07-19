import mongoose from 'mongoose';
import { logger } from '../../shared/logging/logger';
import { MONGODB_DATABASE, MONGODB_URI } from './mongodb.env';

export const connect = async () => {
  const connectionString = `${MONGODB_URI}/${MONGODB_DATABASE}`;

  logger.info(`Connecting to MongoDB`);

  await mongoose.connect(connectionString);

  logger.info('MongoDB connected!');

  mongoose.connection.on('error', (error) => {
    logger.error('MongoDB error:', error);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected!');
  });
}

export const disconnect = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error('Error disconnecting MongoDB:', error);
  }
}