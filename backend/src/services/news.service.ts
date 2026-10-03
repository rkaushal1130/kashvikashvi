import { NewsStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import {
  CreateNewsInput,
  NewsQueryInput,
  UpdateNewsInput,
} from '../validators/news.validators';

export interface FormattedNews {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  image: string | null;
  status: NewsStatus;
  publishedAt: Date | null;
  authorId: string | null;
  author?: {
    id: string;
    email: string;
    displayName?: string;
  } | null;
  targetAudience: string;
  createdAt: Date;
  updatedAt: Date;
}

export class NewsService {
  /**
   * Helper to format a raw news record into a standardized payload.
   */
  public static formatNews(news: any): FormattedNews {
    const authorUser = news.author;
    const distributor = authorUser?.distributorProfile;
    const authorDisplayName = distributor?.displayName ||
      (distributor?.firstName ? `${distributor.firstName} ${distributor.lastName}`.trim() : null) ||
      authorUser?.email;

    return {
      id: news.id,
      title: news.title,
      slug: news.slug,
      summary: news.summary,
      content: news.content,
      image: news.image ?? news.bannerUrl ?? null,
      status: news.status ?? (news.isPublished ? 'PUBLISHED' : 'DRAFT'),
      publishedAt: news.publishedAt ?? null,
      authorId: news.authorId ?? null,
      author: authorUser
        ? {
            id: authorUser.id,
            email: authorUser.email,
            displayName: authorDisplayName ?? undefined,
          }
        : undefined,
      targetAudience: news.targetAudience ?? 'ALL',
      createdAt: news.createdAt,
      updatedAt: news.updatedAt,
    };
  }

  /**
   * Generates a clean URL slug from title.
   */
  public static slugify(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || `news-${Date.now()}`;
  }

  /**
   * Seed default announcements if database has no news.
   */
  public static async ensureDefaultNews(): Promise<void> {
    const count = await prisma.news.count();
    if (count > 0) return;

    await prisma.news.createMany({
      data: [
        {
          title: 'All of Your Team Manager Reports Are Now Free',
          slug: 'all-team-manager-reports-are-now-free',
          summary:
            'Great news—we’ve made all 40+ Team Manager Reports available to every Brand Partner at no cost.',
          content:
            'We are thrilled to announce that all 40+ Team Manager Reports are now unlocked and completely free for every active distributor worldwide. Use these real-time analytics to monitor binary leg volumes, jumpstart completions, and group sales velocity.',
          image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=80',
          bannerUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=80',
          status: 'PUBLISHED',
          isPublished: true,
          publishedAt: new Date('2026-03-01T08:00:00.000Z'),
          targetAudience: 'ALL',
        },
        {
          title: 'Q1 Global Convention & Leadership Summit Announced',
          slug: 'q1-global-convention-leadership-summit',
          summary:
            'Registration is officially open for our upcoming Global Convention celebrating our top leaders and newest ranks.',
          content:
            'Join thousands of associates, founders, and industry trailblazers for 3 power-packed days of keynote sessions, advanced binary team building workshops, and new product unveilings.',
          image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
          bannerUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
          status: 'PUBLISHED',
          isPublished: true,
          publishedAt: new Date('2026-03-10T10:00:00.000Z'),
          targetAudience: 'ALL',
        },
        {
          title: 'New Smart Health Wearable Series Now Available',
          slug: 'new-smart-health-wearable-series',
          summary:
            'Experience our next-generation connected smart devices with integrated BV tracking and companion mobile sync.',
          content:
            'Our flagship connected smart device line is here! Featuring advanced biometrics, battery life up to 14 days, and enhanced BV allocations designed to boost your binary commission checks.',
          image: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=800&q=80',
          bannerUrl: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=800&q=80',
          status: 'PUBLISHED',
          isPublished: true,
          publishedAt: new Date('2026-03-18T12:00:00.000Z'),
          targetAudience: 'ALL',
        },
      ],
    });

    logger.info('Default news announcements seeded successfully');
  }

  /**
   * Public: List published news articles with search, sorting, and pagination.
   * GET /api/v1/news
   */
  public static async getPublicNews(query: NewsQueryInput) {
    await this.ensureDefaultNews();

    const { search, targetAudience, page = 1, limit = 10, sort = 'newest' } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      status: 'PUBLISHED',
      isPublished: true,
    };

    if (targetAudience && targetAudience !== 'ALL') {
      where.targetAudience = { in: ['ALL', targetAudience] };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { publishedAt: 'desc' };
    if (sort === 'oldest') orderBy = { publishedAt: 'asc' };
    else if (sort === 'title_asc') orderBy = { title: 'asc' };
    else if (sort === 'title_desc') orderBy = { title: 'desc' };

    const [items, total] = await Promise.all([
      prisma.news.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          author: {
            include: { distributorProfile: true },
          },
        },
      }),
      prisma.news.count({ where }),
    ]);

    return {
      items: items.map((item) => this.formatNews(item)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Public: Retrieve a published news article by slug or id.
   * GET /api/v1/news/:slug
   */
  public static async getPublicNewsBySlug(slugOrId: string): Promise<FormattedNews> {
    await this.ensureDefaultNews();

    const news = await prisma.news.findFirst({
      where: {
        OR: [{ slug: slugOrId }, { id: slugOrId }],
      },
      include: {
        author: {
          include: { distributorProfile: true },
        },
      },
    });

    if (!news) {
      throw AppError.notFound(`News article '${slugOrId}' not found.`, 'NEWS_NOT_FOUND');
    }

    const isLive = news.status === 'PUBLISHED' || news.isPublished;
    if (!isLive) {
      throw AppError.notFound('This news article is not published or is currently a draft.', 'NEWS_UNPUBLISHED');
    }

    return this.formatNews(news);
  }

  /**
   * Admin: List all news articles including drafts and archived items.
   * GET /api/v1/admin/news
   */
  public static async getAdminNews(query: NewsQueryInput) {
    const { search, status, targetAudience, page = 1, limit = 10, sort = 'newest' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (targetAudience) {
      where.targetAudience = targetAudience;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'oldest') orderBy = { createdAt: 'asc' };
    else if (sort === 'title_asc') orderBy = { title: 'asc' };
    else if (sort === 'title_desc') orderBy = { title: 'desc' };

    const [items, total] = await Promise.all([
      prisma.news.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          author: {
            include: { distributorProfile: true },
          },
        },
      }),
      prisma.news.count({ where }),
    ]);

    return {
      items: items.map((item) => this.formatNews(item)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Admin: Create a new news article.
   * POST /api/v1/admin/news
   */
  public static async createNews(
    input: CreateNewsInput,
    adminUserId?: string
  ): Promise<FormattedNews> {
    // Generate or validate slug
    let candidateSlug = input.slug ? input.slug.trim().toLowerCase() : this.slugify(input.title);

    const existingSlug = await prisma.news.findUnique({
      where: { slug: candidateSlug },
    });

    if (existingSlug) {
      if (input.slug) {
        throw AppError.badRequest(`Slug '${input.slug}' is already in use.`, 'SLUG_TAKEN');
      }
      // Auto-suffix if generated
      candidateSlug = `${candidateSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const status = input.status || 'DRAFT';
    const isPublished = status === 'PUBLISHED';
    let publishedAt: Date | null = null;
    if (input.publishedAt) {
      publishedAt = new Date(input.publishedAt);
    } else if (isPublished) {
      publishedAt = new Date();
    }

    const authorId = input.authorId || adminUserId || null;

    const news = await prisma.news.create({
      data: {
        title: input.title,
        slug: candidateSlug,
        summary: input.summary,
        content: input.content,
        image: input.image ?? null,
        bannerUrl: input.image ?? null,
        status,
        isPublished,
        publishedAt,
        authorId,
        targetAudience: input.targetAudience || 'ALL',
      },
      include: {
        author: {
          include: { distributorProfile: true },
        },
      },
    });

    logger.info({ newsId: news.id, slug: news.slug }, 'News article created successfully');

    return this.formatNews(news);
  }

  /**
   * Admin: Update an existing news article.
   * PATCH /api/v1/admin/news/:id
   */
  public static async updateNews(
    id: string,
    input: UpdateNewsInput
  ): Promise<FormattedNews> {
    const existing = await prisma.news.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
    });

    if (!existing) {
      throw AppError.notFound(`News article with identifier '${id}' not found.`, 'NEWS_NOT_FOUND');
    }

    // Slug validation if updating slug
    if (input.slug && input.slug !== existing.slug) {
      const slugCollision = await prisma.news.findUnique({
        where: { slug: input.slug },
      });
      if (slugCollision && slugCollision.id !== existing.id) {
        throw AppError.badRequest(`Slug '${input.slug}' is already in use.`, 'SLUG_TAKEN');
      }
    }

    const nextStatus = input.status !== undefined ? input.status : existing.status;
    const isPublished = nextStatus === 'PUBLISHED';

    let nextPublishedAt = existing.publishedAt;
    if (input.publishedAt !== undefined) {
      nextPublishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
    } else if (isPublished && !existing.publishedAt) {
      nextPublishedAt = new Date();
    }

    const updated = await prisma.news.update({
      where: { id: existing.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.image !== undefined
          ? { image: input.image, bannerUrl: input.image }
          : {}),
        ...(input.status !== undefined
          ? { status: input.status, isPublished }
          : {}),
        ...(input.publishedAt !== undefined || (isPublished && !existing.publishedAt)
          ? { publishedAt: nextPublishedAt }
          : {}),
        ...(input.authorId !== undefined ? { authorId: input.authorId } : {}),
        ...(input.targetAudience !== undefined
          ? { targetAudience: input.targetAudience }
          : {}),
      },
      include: {
        author: {
          include: { distributorProfile: true },
        },
      },
    });

    logger.info({ newsId: updated.id }, 'News article updated successfully');

    return this.formatNews(updated);
  }

  /**
   * Admin: Delete a news article.
   * DELETE /api/v1/admin/news/:id
   */
  public static async deleteNews(id: string): Promise<void> {
    const existing = await prisma.news.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
    });

    if (!existing) {
      throw AppError.notFound(`News article with identifier '${id}' not found.`, 'NEWS_NOT_FOUND');
    }

    await prisma.news.delete({
      where: { id: existing.id },
    });

    logger.info({ newsId: existing.id, slug: existing.slug }, 'News article deleted successfully');
  }
}
