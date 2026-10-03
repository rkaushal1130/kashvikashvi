import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  isTicker: boolean;
  imageUrl?: string;
  publishedAt: string;
  author: string;
}

const newsDatabase: NewsItem[] = [
  {
    id: 'news-001',
    title: 'New Launch: Kashvi 5G Flagship Smartphones & Ultra-Slim Laptops',
    summary: 'Next-generation electronics series now live on the distributor wholesale portal with double BV points.',
    content: 'KashviMLM is thrilled to unveil our cutting-edge 5G Flagship Smartphones and Ultra-Slim Performance Laptops. Engineered for modern high-performance connectivity, every direct purchase by registered distributors earns 2X BV points toward weekly matching bonuses.',
    category: 'Product Launch',
    isTicker: true,
    imageUrl: '/assets/dashboard/news_thumb_1.jpg',
    publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    author: 'Corporate Communications',
  },
  {
    id: 'news-002',
    title: 'Autumn Drop: Pure Combed Cotton Tees and Winter Fleece Hoodies',
    summary: 'High-grade hosiery garments stocked across all regional fulfillment centers nationwide.',
    content: 'Premium breathable combed cotton and heavy-GSM winter fleece hoodies have arrived. Distributors enjoy wholesale discounts up to 35% off retail MRP alongside accelerated personal sales volume (PSV).',
    category: 'Product Launch',
    isTicker: true,
    imageUrl: '/assets/dashboard/news_thumb_2.jpg',
    publishedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    author: 'Apparel Merchandising Team',
  },
  {
    id: 'news-003',
    title: 'Prague International Leadership Convention Contest 2026',
    summary: 'Qualify for an all-expenses-paid 5-star executive leadership retreat to Prague, Czech Republic.',
    content: 'Achieve Diamond rank or generate 5,000 Group Business Volume (GBV) on both left and right binary legs between October and December 2026 to secure your luxury executive trip to Prague.',
    category: 'Contest',
    isTicker: false,
    imageUrl: '/assets/dashboard/prague_contest.jpg',
    publishedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    author: 'Executive Leadership Board',
  },
  {
    id: 'news-004',
    title: 'Pan-India Express: Free Insured Door Delivery on Orders over ₹999',
    summary: 'Direct doorstep delivery now available across 15+ states with zero shipping surcharge.',
    content: 'To empower our independent brand partners and consumers, all wholesale cart checkouts surpassing ₹999 receive complimentary expedited shipping with transit insurance.',
    category: 'Announcement',
    isTicker: true,
    publishedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    author: 'Logistics Operations',
  },
  {
    id: 'news-005',
    title: 'Leadership Milestone: 120+ Newly Certified Gold & Diamond Leaders',
    summary: 'Congratulations to our dynamic field champions breaking performance records this cycle.',
    content: 'Special commendations to our frontline network leaders across Delhi, Haryana, Punjab, and Maharashtra for exceptional team mentoring, binary leg balancing, and customer retail volume growth.',
    category: 'Leadership',
    isTicker: true,
    publishedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    author: 'Recognition Committee',
  },
];

export class NewsController {
  static async listNews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, tickerOnly, limit = 20 } = req.query;

      let results = [...newsDatabase];

      if (category) {
        results = results.filter((n) => n.category.toLowerCase() === String(category).toLowerCase());
      }

      if (tickerOnly === 'true') {
        results = results.filter((n) => n.isTicker);
      }

      const parsedLimit = Math.min(Number(limit) || 20, 100);
      results = results.slice(0, parsedLimit);

      res.status(200).json({
        success: true,
        count: results.length,
        data: results,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getNewsById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const item = newsDatabase.find((n) => n.id === id);

      if (!item) {
        res.status(404).json({
          success: false,
          message: `News article with ID '${id}' was not found.`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: item,
      });
    } catch (err) {
      next(err);
    }
  }

  static async createNews(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, summary, content, category, isTicker, imageUrl } = req.body;

      const newItem: NewsItem = {
        id: `news-${Date.now().toString(36)}`,
        title,
        summary,
        content,
        category: category || 'Announcement',
        isTicker: Boolean(isTicker),
        imageUrl,
        publishedAt: new Date().toISOString(),
        author: req.user?.username || 'Executive Admin',
      };

      newsDatabase.unshift(newItem);

      await AuditService.recordFromRequest(
        req,
        AuditAction.ADMIN_ACTION,
        'NewsArticle',
        newItem.id,
        null,
        newItem
      );

      res.status(201).json({
        success: true,
        message: 'News announcement created successfully.',
        data: newItem,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteNews(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const index = newsDatabase.findIndex((n) => n.id === id);

      if (index === -1) {
        res.status(404).json({
          success: false,
          message: `News article '${id}' does not exist.`,
        });
        return;
      }

      const deleted = newsDatabase.splice(index, 1)[0];

      await AuditService.recordFromRequest(
        req,
        AuditAction.ADMIN_ACTION,
        'NewsArticle',
        id,
        deleted,
        null
      );

      res.status(200).json({
        success: true,
        message: 'News article removed successfully.',
      });
    } catch (err) {
      next(err);
    }
  }
}
