import { Router } from 'express';
import { WebsiteController } from './website.controller.js';

export const websiteRoutes = Router();

// 1. GET /api/v1/website/info - Public company overview, contacts, legal compliance
websiteRoutes.get('/info', WebsiteController.getInfo);

// 2. GET /api/v1/website/banners - Active hero promotional banners and contests
websiteRoutes.get('/banners', WebsiteController.getBanners);

// 3. GET /api/v1/website/leadership - Executive leadership, founder, and Diamond directors
websiteRoutes.get('/leadership', WebsiteController.getLeadership);

export default websiteRoutes;
