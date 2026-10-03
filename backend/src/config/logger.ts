import pino from 'pino';
import { env, isDev, isTest } from './env';

const loggerConfig = {
  level: isTest ? 'silent' : isDev ? 'debug' : 'info',
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),
  timestamp: pino.stdTimeFunctions.isoTime,
};

export const logger = pino(loggerConfig);
