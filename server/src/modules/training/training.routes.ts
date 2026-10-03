import { Router } from 'express';
import { TrainingController } from './training.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

export const trainingRoutes = Router();

trainingRoutes.use(authenticateToken);

trainingRoutes.get('/modules', TrainingController.getModules);
trainingRoutes.post('/complete', TrainingController.completeModule);
