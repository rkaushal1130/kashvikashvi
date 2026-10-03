import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import {
  CreateWebsiteLinkInput,
  UpdateDistributorWebsiteInput,
  UpdateWebsiteLinkInput,
} from '../validators/website.validators';

export interface FormattedWebsiteLink {
  id: string;
  websiteId: string;
  label: string;
  url: string;
  type: string;
  sortOrder: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormattedDistributorWebsite {
  id: string;
  distributorId: string;
  slug: string;
  subdomain: string;
  title: string;
  description: string | null;
  theme: string;
  logo: string | null;
  isPublished: boolean;
  links?: FormattedWebsiteLink[];
  createdAt: Date;
  updatedAt: Date;
  distributor?: {
    id: string;
    distributorCode: string;
    displayName: string;
    email?: string;
  };
}

export interface FormattedPublicDistributorWebsite {
  id: string;
  distributorId: string;
  slug: string;
  subdomain: string;
  title: string;
  description: string | null;
  theme: string;
  logo: string | null;
  bannerUrl: string | null;
  isPublished: boolean;
  contactEmail?: string | null;
  contactPhone?: string | null;
  socialLinks?: any;
  createdAt: Date;
  updatedAt: Date;
  distributor: {
    id: string;
    distributorCode: string;
    displayName: string;
    firstName: string;
    lastName: string;
    status: string;
    memberSince: string;
    rank?: {
      name: string;
      displayName?: string;
      badgeIcon?: string | null;
    } | null;
  };
  links: FormattedWebsiteLink[];
  storefrontUrls: {
    referralLink: string;
    enrollmentLink: string;
    shopLink: string;
    contactLink: string;
  };
}

export class DistributorWebsiteService {
  /**
   * Formats a raw WebsiteLink instance.
   */
  public static formatLink(link: any): FormattedWebsiteLink {
    return {
      id: link.id,
      websiteId: link.websiteId,
      label: link.label ?? 'Shop Products',
      url: link.url ?? link.targetUrl ?? '/',
      type: link.type ?? 'CUSTOM',
      sortOrder: link.sortOrder ?? 0,
      enabled: Boolean(link.enabled),
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    };
  }

  /**
   * Formats a raw DistributorWebsite instance.
   */
  public static formatWebsite(website: any): FormattedDistributorWebsite {
    return {
      id: website.id,
      distributorId: website.distributorId,
      slug: website.slug ?? website.subdomain,
      subdomain: website.subdomain,
      title: website.title ?? website.siteTitle ?? 'My KASHVIMLM Store',
      description: website.description ?? website.bio ?? null,
      theme: website.theme ?? 'LIGHT',
      logo: website.logo ?? website.bannerUrl ?? null,
      isPublished: Boolean(website.isPublished ?? website.isActive ?? true),
      links: Array.isArray(website.links)
        ? website.links.map((l: any) => this.formatLink(l))
        : undefined,
      createdAt: website.createdAt,
      updatedAt: website.updatedAt,
      distributor: website.distributor
        ? {
            id: website.distributor.id,
            distributorCode: website.distributor.distributorCode,
            displayName: website.distributor.displayName,
            email: website.distributor.user?.email,
          }
        : undefined,
    };
  }

  /**
   * Retrieves or auto-initializes the authenticated distributor's website.
   */
  public static async getOrCreateWebsite(userId: string): Promise<FormattedDistributorWebsite> {
    const distributor = await prisma.distributorProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!distributor) {
      throw AppError.notFound('Distributor profile not found.', 'DISTRIBUTOR_NOT_FOUND');
    }

    let website = await prisma.distributorWebsite.findUnique({
      where: { distributorId: distributor.id },
      include: {
        links: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        distributor: {
          include: { user: true },
        },
      },
    });

    if (!website) {
      // Auto-provision personal replicated website
      const cleanCode = distributor.distributorCode.toLowerCase().replace(/[^a-z0-9]/g, '');
      const defaultSubdomain = `partner-${cleanCode || Math.floor(1000 + Math.random() * 9000)}`;
      const defaultSlug = defaultSubdomain;
      const ownerName = distributor.displayName || distributor.firstName || 'Brand Partner';

      website = await prisma.distributorWebsite.create({
        data: {
          distributorId: distributor.id,
          subdomain: defaultSubdomain,
          slug: defaultSlug,
          title: `${ownerName}'s Official Store`,
          siteTitle: `${ownerName}'s Official Store`,
          description: `Welcome to my official KASHVIMLM store! Browse premium wellness apparel and smart connected devices with direct shipping.`,
          theme: 'LIGHT',
          isPublished: true,
          isActive: true,
          links: {
            create: [
              {
                label: 'Shop Products',
                url: '/products',
                type: 'SHOP',
                sortOrder: 1,
                enabled: true,
              },
              {
                label: 'Join My Team',
                url: '/enroll',
                type: 'ENROLL',
                sortOrder: 2,
                enabled: true,
              },
              {
                label: 'Contact Me',
                url: '/contact',
                type: 'CONTACT',
                sortOrder: 3,
                enabled: true,
              },
            ],
          },
        },
        include: {
          links: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
          distributor: {
            include: { user: true },
          },
        },
      });

      logger.info(
        { distributorId: distributor.id, subdomain: website.subdomain },
        'Auto-provisioned personal replicated website for distributor'
      );
    }

    return this.formatWebsite(website);
  }

  /**
   * Updates distributor website settings (title, description, theme, logo, slug, subdomain, isPublished).
   */
  public static async updateWebsite(
    userId: string,
    input: UpdateDistributorWebsiteInput
  ): Promise<FormattedDistributorWebsite> {
    const distributor = await prisma.distributorProfile.findUnique({
      where: { userId },
    });

    if (!distributor) {
      throw AppError.notFound('Distributor profile not found.', 'DISTRIBUTOR_NOT_FOUND');
    }

    // Ensure website exists
    const current = await this.getOrCreateWebsite(userId);

    // Verify subdomain uniqueness if changing
    if (input.subdomain && input.subdomain !== current.subdomain) {
      const existingSubdomain = await prisma.distributorWebsite.findUnique({
        where: { subdomain: input.subdomain },
      });
      if (existingSubdomain && existingSubdomain.id !== current.id) {
        throw AppError.badRequest(
          `Subdomain '${input.subdomain}' is already taken. Please choose another one.`,
          'SUBDOMAIN_TAKEN'
        );
      }
    }

    // Verify slug uniqueness if changing
    if (input.slug && input.slug !== current.slug) {
      const existingSlug = await prisma.distributorWebsite.findFirst({
        where: { slug: input.slug },
      });
      if (existingSlug && existingSlug.id !== current.id) {
        throw AppError.badRequest(
          `Slug '${input.slug}' is already in use. Please choose another one.`,
          'SLUG_TAKEN'
        );
      }
    }

    const updated = await prisma.distributorWebsite.update({
      where: { id: current.id },
      data: {
        ...(input.subdomain !== undefined ? { subdomain: input.subdomain } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.title !== undefined
          ? { title: input.title, siteTitle: input.title }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description, bio: input.description }
          : {}),
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
        ...(input.logo !== undefined
          ? { logo: input.logo, bannerUrl: input.logo }
          : {}),
        ...(input.isPublished !== undefined
          ? { isPublished: input.isPublished, isActive: input.isPublished }
          : {}),
      },
      include: {
        links: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        distributor: {
          include: { user: true },
        },
      },
    });

    logger.info({ websiteId: updated.id }, 'Distributor website updated successfully');

    return this.formatWebsite(updated);
  }

  /**
   * Retrieves all links for the distributor's website.
   */
  public static async getLinks(userId: string): Promise<FormattedWebsiteLink[]> {
    const website = await this.getOrCreateWebsite(userId);

    const links = await prisma.websiteLink.findMany({
      where: { websiteId: website.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return links.map((l) => this.formatLink(l));
  }

  /**
   * Creates a new navigation or social link for the distributor's website.
   */
  public static async createLink(
    userId: string,
    input: CreateWebsiteLinkInput
  ): Promise<FormattedWebsiteLink> {
    const website = await this.getOrCreateWebsite(userId);

    const link = await prisma.websiteLink.create({
      data: {
        websiteId: website.id,
        label: input.label,
        url: input.url,
        type: input.type || 'CUSTOM',
        sortOrder: input.sortOrder ?? 0,
        enabled: input.enabled ?? true,
      },
    });

    logger.info({ linkId: link.id, websiteId: website.id }, 'Website link created');

    return this.formatLink(link);
  }

  /**
   * Updates an existing website link.
   */
  public static async updateLink(
    userId: string,
    linkId: string,
    input: UpdateWebsiteLinkInput
  ): Promise<FormattedWebsiteLink> {
    const website = await this.getOrCreateWebsite(userId);

    const link = await prisma.websiteLink.findFirst({
      where: {
        id: linkId,
        websiteId: website.id,
      },
    });

    if (!link) {
      throw AppError.notFound('Website link not found.', 'LINK_NOT_FOUND');
    }

    const updated = await prisma.websiteLink.update({
      where: { id: link.id },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.url !== undefined ? { url: input.url, targetUrl: input.url } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
    });

    return this.formatLink(updated);
  }

  /**
   * Deletes a website link.
   */
  public static async deleteLink(userId: string, linkId: string): Promise<void> {
    const website = await this.getOrCreateWebsite(userId);

    const link = await prisma.websiteLink.findFirst({
      where: {
        id: linkId,
        websiteId: website.id,
      },
    });

    if (!link) {
      throw AppError.notFound('Website link not found.', 'LINK_NOT_FOUND');
    }

    await prisma.websiteLink.delete({
      where: { id: link.id },
    });

    logger.info({ linkId, websiteId: website.id }, 'Website link deleted');
  }

  /**
   * Retrieves public replicated website and active navigation links by slug or distributor code.
   * Public-facing (no authentication required).
   */
  public static async getPublicWebsiteBySlug(
    slug: string
  ): Promise<FormattedPublicDistributorWebsite> {
    const trimmedSlug = slug.trim();
    if (!trimmedSlug) {
      throw AppError.badRequest('Distributor slug or code is required.', 'INVALID_SLUG');
    }

    const includeQuery = {
      distributor: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              status: true,
              createdAt: true,
            },
          },
          currentRank: {
            select: {
              id: true,
              name: true,
              rankCode: true,
              iconUrl: true,
            },
          },
        },
      },
      links: {
        where: {
          enabled: true,
        },
        orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
      },
    };

    let website: any = await prisma.distributorWebsite.findFirst({
      where: {
        OR: [
          { slug: trimmedSlug },
          { subdomain: trimmedSlug },
          { slug: trimmedSlug.toLowerCase() },
          { subdomain: trimmedSlug.toLowerCase() },
          {
            distributor: {
              distributorCode: {
                equals: trimmedSlug,
                mode: 'insensitive',
              },
            },
          },
        ],
      },
      include: includeQuery,
    });

    if (!website) {
      // Check if distributor exists by distributor code or ID and auto-provision default storefront
      const distributor = await prisma.distributorProfile.findFirst({
        where: {
          OR: [
            { distributorCode: { equals: trimmedSlug, mode: 'insensitive' } },
            { id: trimmedSlug },
          ],
        },
        include: { user: true },
      });

      if (distributor) {
        await this.getOrCreateWebsite(distributor.userId);
        website = await prisma.distributorWebsite.findFirst({
          where: { distributorId: distributor.id },
          include: includeQuery,
        });
      }
    }

    if (!website) {
      throw AppError.notFound(`Distributor website '${trimmedSlug}' not found.`, 'WEBSITE_NOT_FOUND');
    }

    const isPublished = Boolean(website.isPublished ?? website.isActive ?? true);
    if (!isPublished) {
      throw AppError.notFound(
        'This distributor storefront is currently private or unpublished.',
        'WEBSITE_UNPUBLISHED'
      );
    }

    if (website.distributor && website.distributor.status !== 'ACTIVE') {
      throw AppError.notFound(
        'This distributor storefront is currently unavailable.',
        'DISTRIBUTOR_UNAVAILABLE'
      );
    }

    const activeLinks: FormattedWebsiteLink[] = (website.links || []).map((l: any) =>
      this.formatLink(l)
    );
    const dist = website.distributor;
    const distCode = dist?.distributorCode || '';
    const siteSlug = website.slug || website.subdomain;

    return {
      id: website.id,
      distributorId: website.distributorId,
      slug: siteSlug,
      subdomain: website.subdomain,
      title: website.title ?? website.siteTitle ?? 'My KASHVIMLM Store',
      description: website.description ?? website.bio ?? null,
      theme: website.theme ?? 'LIGHT',
      logo: website.logo ?? website.bannerUrl ?? null,
      bannerUrl: website.bannerUrl ?? website.logo ?? null,
      isPublished: true,
      contactEmail: website.contactEmail ?? dist?.user?.email ?? null,
      contactPhone: website.contactPhone ?? dist?.user?.phone ?? null,
      socialLinks: website.socialLinks ?? null,
      createdAt: website.createdAt,
      updatedAt: website.updatedAt,
      distributor: {
        id: dist?.id ?? '',
        distributorCode: distCode,
        displayName:
          dist?.displayName ||
          `${dist?.firstName || ''} ${dist?.lastName || ''}`.trim() ||
          'Brand Partner',
        firstName: dist?.firstName || '',
        lastName: dist?.lastName || '',
        status: dist?.status || 'ACTIVE',
        memberSince: (dist?.createdAt || new Date()).getFullYear().toString(),
        rank: dist?.currentRank
          ? {
              name: dist.currentRank.name,
              displayName: dist.currentRank.name,
              badgeIcon: dist.currentRank.iconUrl ?? null,
            }
          : null,
      },
      links: activeLinks,
      storefrontUrls: {
        referralLink: `/enroll?sponsor=${distCode}`,
        enrollmentLink: `/enroll?sponsor=${distCode}`,
        shopLink: `/products?ref=${siteSlug}`,
        contactLink: `/contact?distributor=${distCode}`,
      },
    };
  }
}
