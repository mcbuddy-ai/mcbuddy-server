import { Job } from 'bullmq';
import { ask } from '../../features/ask/ask.service';
import { askx } from '../../features/askx/askx.service';
import { logger } from '../../shared/logging/logger';
import { AskJobData, AskXJobData, JobData, JobResult, createAiWorker } from './queue.config';

const processAskJob = async (job: Job<AskJobData>): Promise<JobResult> => {
  const { userId, question, platform, token } = job.data;
  
  logger.info(`Processing ASK job ${job.id}`, { userId, platform });
  
  try {
    const result = await ask(userId, question, platform, token)();
    
    if (result._tag === 'Left') {
      return {
        success: false,
        error: {
          message: result.left.message,
          code: result.left.code,
          statusCode: result.left.statusCode || 500,
        },
      };
    }
    
    return {
      success: true,
      data: result.right,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'PROCESSING_ERROR',
        statusCode: 500,
      },
    };
  }
};

const processAskXJob = async (job: Job<AskXJobData>): Promise<JobResult> => {
  const { action, platform, token } = job.data;
  
  logger.info(`Processing ASKX job ${job.id}`, { platform });
  
  try {
    const result = await askx(action, platform, token)();
    
    if (result._tag === 'Left') {
      return {
        success: false,
        error: {
          message: result.left.message,
          code: result.left.code,
          statusCode: result.left.statusCode || 500,
        },
      };
    }
    
    return {
      success: true,
      data: result.right,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'PROCESSING_ERROR',
        statusCode: 500,
      },
    };
  }
};

const processJob = async (job: Job<JobData>): Promise<JobResult> => {
  const startTime = Date.now();
  
  try {
    let result: JobResult;
    
    switch (job.data.type) {
      case 'ask':
        result = await processAskJob(job as Job<AskJobData>);
        break;
      case 'askx':
        result = await processAskXJob(job as Job<AskXJobData>);
        break;
      default:
        result = {
          success: false,
          error: {
            message: 'Unknown job type',
            code: 'UNKNOWN_JOB_TYPE',
            statusCode: 400,
          },
        };
    }
    
    const duration = Date.now() - startTime;
    logger.info(`Job ${job.id} processed in ${duration}ms`, { 
      success: result.success,
      type: job.data.type 
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Job ${job.id} failed after ${duration}ms`, { error });
    
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'PROCESSING_ERROR',
        statusCode: 500,
      },
    };
  }
};

export const aiWorker = createAiWorker(processJob);

export const shutdownWorker = async (): Promise<void> => {
  logger.info('Shutting down AI worker...');
  await aiWorker.close();
  logger.info('AI worker shut down successfully');
};