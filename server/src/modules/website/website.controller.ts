import { Request, Response, NextFunction } from 'express';

export class WebsiteController {
  static async getInfo(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: {
          companyName: 'KashviMLM (Kashvi Vadic Lifestyle Pvt. Ltd.)',
          tagline: 'Empowering Independent Direct Sellers Across India',
          founder: {
            name: 'Rahul Kaushal',
            memberId: '88767139',
            title: 'Founding Chairman & Chief Visionary Officer',
          },
          corporateOffice: {
            street: 'SCO 42-43, Sector 17-C',
            city: 'Chandigarh',
            state: 'Punjab / Chandigarh UT',
            pincode: '160017',
            country: 'India',
          },
          customerCare: {
            primaryPhone: '+91 70156 43886',
            secondaryPhone: '+91 98765 43210',
            primaryEmail: 'kashvicustomercare@gmail.com',
            supportEmail: 'support@kashvimlm.com',
            operatingHours: 'Monday - Saturday: 9:30 AM - 6:30 PM IST',
          },
          legal: {
            registrationType: 'Direct Selling Entity (MCA India Compliant)',
            cin: 'U52100CH2024PTC045812',
            gstNumber: '04AABCK1234F1Z8',
            panNumber: 'AABCK1234F',
            isoCertified: 'ISO 9001:2015 Quality Management Certified',
          },
          operatingStats: {
            activeDistributors: '50,000+',
            operatingStates: '15+ States across India',
            deliveryPinCodes: '19,000+',
            compensationModel: 'Dual-Leg Binary MLM with 10% Matching Bonus',
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getBanners(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: [
          {
            id: 'banner-01',
            title: 'Autumn Fashion & Hosiery Drop 2026',
            subtitle: 'Direct Selling Wholesale Collection with up to 35% Margins',
            ctaText: 'Shop Wholesale Catalog',
            ctaLink: '/products',
            badge: 'NEW COLLECTION',
            imageUrl: '/assets/dashboard/news_thumb_2.jpg',
          },
          {
            id: 'banner-02',
            title: 'Kashvi 5G Smart Tech & Computing',
            subtitle: 'Next-gen devices powered with 2X Business Volume (BV) Points',
            ctaText: 'Explore Electronics',
            ctaLink: '/products?category=Electronics',
            badge: '2X BV ACTIVE',
            imageUrl: '/assets/dashboard/news_thumb_1.jpg',
          },
          {
            id: 'banner-03',
            title: 'Prague International Leadership Trip 2026',
            subtitle: 'Qualify for an all-expenses-paid luxury convention in Europe',
            ctaText: 'View Contest Guidelines',
            ctaLink: '/training',
            badge: 'GLOBAL RETREAT',
            imageUrl: '/assets/dashboard/prague_contest.jpg',
          },
        ],
      });
    } catch (err) {
      next(err);
    }
  }

  static async getLeadership(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: {
          founder: {
            name: 'Rahul Kaushal',
            memberId: '88767139',
            role: 'Founder & Managing Director',
            bio: 'Direct selling veteran with 15+ years of leadership in compensation engine design and consumer retail expansion.',
          },
          topLeaders: [
            {
              name: 'Vikramjit Singh',
              rank: 'Crown Diamond Director',
              region: 'North Zone (Punjab & Haryana)',
              teamSize: '18,500+ Active Partners',
            },
            {
              name: 'Sunita Sharma',
              rank: 'Diamond Director',
              region: 'Delhi NCR',
              teamSize: '12,200+ Active Partners',
            },
            {
              name: 'Amitabh Mukherjee',
              rank: 'Executive Platinum Leader',
              region: 'East Zone (Kolkata & Bihar)',
              teamSize: '9,400+ Active Partners',
            },
          ],
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
