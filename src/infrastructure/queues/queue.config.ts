import { Queue, Worker, QueueOptions, WorkerOptions } from 'bullmq';
import { logger } from '../../shared/logging/logger';

export interface AskJobData {
  type: 'ask';
  userId: string;
  question: string;
  platform: string;
  token?: string;
  jobId: string;
}

export interface AskXJobData {
  type: 'askx';
  action: string;
  platform: string;
  token?: string;
  jobId: string;
}

export type JobData = AskJobData | AskXJobData;

export type JobResult = 
  | {
      success: true;
      data: any;
    }
  | {
      success: false;
      error: {
        message: string;
        code: string;
        statusCode: number;
      };
    };

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
};

const queueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100, // Хранить только последние 100 выполненных задач
    removeOnFail: 50,      // Хранить только последние 50 неудачных задач
    attempts: 3,           // Максимум 3 попытки
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

const workerOptions: WorkerOptions = {
  connection: redisConnection,
  concurrency: 10,    // Обрабатывать до 10 задач одновременно
  limiter: {
    max: 10,          // Максимум 10 задач
    duration: 60000,  // За 60 секунд (1 минуту)
  },
};

export const aiQueue = new Queue('ai-requests', queueOptions);

export const createAiWorker = (processor: (job: any) => Promise<JobResult>) => {
  const worker = new Worker('ai-requests', processor, workerOptions);
  
  worker.on('completed', (job, result) => {
    logger.info(`Job ${job.id} completed successfully`, { result });
  });
  
  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed`, { error: err.message });
  });
  
  worker.on('error', (err) => {
    logger.error('Worker error:', err);
  });
  
  return worker;
};

export const addJob = async (jobData: JobData): Promise<string> => {
  const job = await aiQueue.add(jobData.type, jobData, {
    jobId: jobData.jobId,
  });
  
  logger.info(`Added job ${job.id} to queue`, { type: jobData.type });
  return job.id!;
};

export const waitForJobResult = async (jobId: string, timeoutMs: number = 300000): Promise<JobResult> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Job timeout'));
    }, timeoutMs);
    
    const checkJob = async () => {
      try {
        const job = await aiQueue.getJob(jobId);
        
        if (!job) {
          reject(new Error('Job not found'));
          return;
        }
        
        if (job.finishedOn) {
          clearTimeout(timeout);
          const result = job.returnvalue as JobResult;
          resolve(result);
          return;
        }
        
        if (job.failedReason) {
          clearTimeout(timeout);
          resolve({
            success: false,
            error: {
              message: job.failedReason,
              code: 'JOB_FAILED',
              statusCode: 500,
            },
          } as const);
          return;
        }
        
        setTimeout(checkJob, 100);
      } catch (error) {
        clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    
    checkJob();
  });
};