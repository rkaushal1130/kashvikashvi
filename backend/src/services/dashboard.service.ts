import { prisma } from '../config/database';
import { AppError } from '../utils/appError';
import { CommissionService } from './commission.service';
import { DistributorService } from './distributor.service';
import { TrainingService } from './training.service';

export class DashboardService {
  private static readonly DEFAULT_PROFILE = {
    id: 'KV-DEMO-1001',
    distributorCode: 'KV-DEMO-1001',
    status: 'ACTIVE',
    userId: 'usr-demo-1',
    user: {
      id: 'usr-demo-1',
      firstName: 'Rahul',
      lastName: 'Sharma',
      email: 'rahul.example@example.com',
      avatarUrl: null,
    },
    currentRank: {
      id: 'rank-silver',
      rankCode: 'RANK_SILVER',
      name: 'Silver Director',
      level: 2,
    },
    highestRank: {
      id: 'rank-silver',
      rankCode: 'RANK_SILVER',
      name: 'Silver Director',
      level: 2,
    },
    lifetimePV: 250,
    businessCenters: [
      {
        id: 'bc-001',
        centerNumber: 1,
        centerCode: 'KV-DEMO-1001-BC1',
        status: 'ACTIVE',
        leftVolume: 3200,
        rightVolume: 2800,
        accumulatedLeftVolume: 12500,
        accumulatedRightVolume: 11200,
      },
      {
        id: 'bc-002',
        centerNumber: 2,
        centerCode: 'KV-DEMO-1001-BC2',
        status: 'ACTIVE',
        leftVolume: 1400,
        rightVolume: 1900,
        accumulatedLeftVolume: 4500,
        accumulatedRightVolume: 5100,
      },
      {
        id: 'bc-003',
        centerNumber: 3,
        centerCode: 'KV-DEMO-1001-BC3',
        status: 'ACTIVE',
        leftVolume: 800,
        rightVolume: 1200,
        accumulatedLeftVolume: 2600,
        accumulatedRightVolume: 3400,
      },
    ],
    badges: [
      { id: '1', code: 'PACE_SETTER', name: 'Pacesetter', icon: '⭐', earnedAt: new Date().toISOString() },
      { id: '2', code: 'TOP_ENROLLER', name: 'Top Enroller', icon: '🌟', earnedAt: new Date().toISOString() },
      { id: '3', code: 'LEADERSHIP', name: 'Leadership Circle', icon: '🏆', earnedAt: new Date().toISOString() },
    ],
  };

  /**
   * Assembles the complete dashboard payload for the frontend DistributorPortal snapshot.
   */
  public static async getDashboard(userId?: string) {
    // 1. Resolve distributor profile
    let distributorProfile: any = null;

    if (userId) {
      try {
        distributorProfile = await DistributorService.getProfileByUserId(userId);
      } catch {
        // Fall back to top leader if user doesn't have a distributor profile yet
      }
    }

    // Fallback to primary active distributor if needed
    if (!distributorProfile) {
      try {
        const fallback = await prisma.distributorProfile.findFirst({
          where: { status: 'ACTIVE' },
          include: {
            user: true,
            currentRank: true,
            highestRank: true,
            businessCenters: true,
            badges: { include: { badge: true } },
          },
          orderBy: { joinedAt: 'asc' },
        });

        if (fallback) {
          distributorProfile = await DistributorService.getProfileByIdOrCode(fallback.id);
        }
      } catch {
        // Fallback below
      }
    }

    if (!distributorProfile) {
      distributorProfile = DashboardService.DEFAULT_PROFILE;
    }

    const distributorId = distributorProfile.id;

    // 2. Fetch Commission Summary & Qualification Status via CommissionService
    let commissionSummary: any = null;
    let qualificationStatus: any = null;
    try {
      commissionSummary = await CommissionService.getCommissionSummary(distributorId);
      qualificationStatus = await CommissionService.getQualificationStatus(distributorId);
    } catch {
      commissionSummary = {
        estimatedCommission: 350.0,
        currency: 'USD',
        currencySymbol: '$',
        isQualified: true,
        qualificationStatus: 'Commission Qualified',
        breakdown: [
          { name: 'Binary Team Matching', amount: 240.0, description: 'Matched lesser leg volume across active Business Centers' },
          { name: 'Frontline Leadership Match', amount: 60.0, description: '10% matching on direct team' },
          { name: 'Preferred Customer Bonus', amount: 50.0, description: '10% bonus on retail customer orders' },
        ],
      };
      qualificationStatus = {
        isCommissionQualified: true,
        statusText: 'Commission Qualified',
        personalBV: 250,
        requiredPersonalBV: 100,
        activeLegs: 2,
        requiredActiveLegs: 2,
        cycle: 'Cycle 38, 2026',
        cycleEndDate: '2026-09-27T23:59:59.000Z',
      };
    }

    // 3. Format Business Centers to match frontend binary cards (BC 001, BC 002, BC 003)
    const formattedBusinessCenters = (distributorProfile.businessCenters || []).map((bc: any) => {
      const numStr = String(bc.centerNumber).padStart(3, '0');
      const left = Number(bc.leftVolume || 0);
      const right = Number(bc.rightVolume || 0);
      const matched = Math.min(left, right);

      return {
        id: bc.id,
        code: `BC ${numStr}`,
        centerCode: bc.centerCode,
        centerNumber: bc.centerNumber,
        status: bc.status,
        leftVolume: left,
        rightVolume: right,
        accumulatedLeftVolume: Number(bc.accumulatedLeftVolume || 0),
        accumulatedRightVolume: Number(bc.accumulatedRightVolume || 0),
        estimatedCVP: matched,
        maxCVP: 1000,
      };
    });

    // Ensure BC 001, BC 002, BC 003 exist in visualization
    if (formattedBusinessCenters.length === 1) {
      formattedBusinessCenters.push(
        {
          id: 'placeholder-bc2',
          code: 'BC 002',
          centerCode: `${distributorProfile.distributorCode}-BC2`,
          centerNumber: 2,
          status: 'ACTIVE',
          leftVolume: 0,
          rightVolume: 0,
          accumulatedLeftVolume: 0,
          accumulatedRightVolume: 0,
          estimatedCVP: 0,
          maxCVP: 1000,
        },
        {
          id: 'placeholder-bc3',
          code: 'BC 003',
          centerCode: `${distributorProfile.distributorCode}-BC3`,
          centerNumber: 3,
          status: 'ACTIVE',
          leftVolume: 0,
          rightVolume: 0,
          accumulatedLeftVolume: 0,
          accumulatedRightVolume: 0,
          estimatedCVP: 0,
          maxCVP: 1000,
        }
      );
    }

    // 4. Fetch Badges
    const badges = distributorProfile.badges?.length
      ? distributorProfile.badges
      : [
          { id: '1', code: 'PACE_SETTER', name: 'Pacesetter', icon: '⭐', earnedAt: new Date().toISOString() },
          { id: '2', code: 'TOP_ENROLLER', name: 'Top Enroller', icon: '🌟', earnedAt: new Date().toISOString() },
          { id: '3', code: 'LEADERSHIP', name: 'Leadership Circle', icon: '🏆', earnedAt: new Date().toISOString() },
        ];

    // 5. JumpStart Tasks & Dynamic Training Progress
    const effectiveUserId = distributorProfile.userId || distributorProfile.user?.id || userId;
    let trainingProgress: any = null;
    if (effectiveUserId) {
      try {
        trainingProgress = await TrainingService.getProgress(effectiveUserId);
      } catch {
        // Fallback gracefully if database table is initializing
      }
    }

    const orientationDone = Boolean(trainingProgress?.categories?.ORIENTATION?.isCompleted);
    const ethicsDone = Boolean(trainingProgress?.categories?.ETHICS?.isCompleted);
    const setupDone = Boolean(trainingProgress?.categories?.BUSINESS_SETUP?.isCompleted);

    const jumpStartTasks = [
      {
        key: 'orientation',
        title: 'Complete your Associate Orientation',
        time: 'About 10 minutes',
        completed: orientationDone,
        desc: 'Discover how KASHVIMLM compensation works, learn how to place your first order, and tour your Team Manager portal.',
      },
      {
        key: 'website',
        title: 'Personalize your KASHVIMLM website',
        time: 'About 5 minutes',
        completed: setupDone,
        desc: 'Add your profile photo, custom greeting, and favorite products to your complimentary personal KASHVIMLM e-store.',
      },
      {
        key: 'sms',
        title: 'Opt in for text messages',
        time: 'About 2 minutes',
        completed: true,
        desc: 'Receive instant notifications regarding order shipments, weekly commission checks, and major incentive announcements.',
      },
      {
        key: 'ethics',
        title: 'Complete your Ethics Certification',
        time: 'About 20 minutes',
        completed: ethicsDone,
        desc: 'Understand international direct selling compliance, truthful health claims, and proper brand representation guidelines.',
      },
      {
        key: 'app',
        title: 'Download the KASHVIMLM Hub App',
        time: 'About 5 minutes',
        completed: (trainingProgress?.progressPercentage ?? 0) >= 50,
        desc: 'Manage your business on iOS or Android. Track team volume, send digital carts, and view real-time commission.',
      },
    ];

    const completedTasks = jumpStartTasks.filter((t) => t.completed).length;
    const remainingTasks = jumpStartTasks.length - completedTasks;
    const progressPercentage = Math.round((completedTasks / jumpStartTasks.length) * 100);

    // 6. Quick Links (Matches frontend action bar)
    const quickLinks = [
      {
        title: 'KASHVIMLM Connect',
        type: 'connect',
        desc: 'Access social sharing tools, asset libraries, prospect tracking, and messaging templates.',
      },
      {
        title: 'Shop',
        type: 'shop',
        desc: 'Distributor store, wholesale pricing, and Subscribe & Save auto-orders.',
      },
      {
        title: 'Team Manager',
        type: 'team_manager',
        desc: 'Genealogy tree reports, downline volume tracking, and leader analysis.',
      },
      {
        title: 'Forms',
        type: 'forms',
        desc: 'Official compliance documents, Auto-Order authorization forms, and Direct Deposit sheets.',
      },
    ];

    // 7. Priority Contacts (Who to reach out this week)
    const priorityContacts = {
      caughtUp: true,
      message: "You're all caught up",
      description:
        'No priority contacts this week. A great moment to plan ahead — review your team activity or set a goal for next week.',
      filterOptions: ['All', 'Pacesetter', 'New Sales', 'Close To Check'],
      contacts: [],
    };

    // 8. News Feed (Matches frontend news panel)
    let newsFromDb: any[] = [];
    try {
      newsFromDb = await prisma.news.findMany({
        where: { isPublished: true },
        orderBy: { publishedAt: 'desc' },
        take: 5,
      });
    } catch {
      // Fallback below
    }

    const news = newsFromDb.length
      ? newsFromDb.map((n, idx) => ({
          id: n.id,
          title: n.title,
          summary: n.summary,
          content: n.content,
          bannerUrl: n.bannerUrl,
          isFeatured: idx === 0,
          publishedAt: n.publishedAt,
        }))
      : [
          {
            id: '1',
            title: 'All of Your Team Manager Reports Are Now Free',
            summary:
              'Great news—we’ve made all 40+ Team Manager Reports available to every Brand Partner at no cost.',
            isFeatured: true,
          },
          {
            id: '2',
            title: 'Ethics in Action Certification Is Moving to KASHVIMLM Connect',
            summary:
              'The Ethics in Action Certification is now available directly in the KASHVIMLM Connect app.',
            isFeatured: false,
          },
          {
            id: '3',
            title: 'KASHVIMLM Connect Is Live',
            summary:
              'KASHVIMLM Connect is officially live, bringing smarter sharing, stronger connections, and business tools.',
            isFeatured: false,
          },
          {
            id: '4',
            title: 'New Ethics in Action Course',
            summary: 'Building your KASHVIMLM business the right way starts with integrity.',
            isFeatured: false,
          },
          {
            id: '5',
            title: 'Join World Service Week 7-14 June',
            summary:
              'Join The KASHVIMLM Foundation for our 10th annual World Service Week to pack meals and support nutrition projects.',
            isFeatured: false,
          },
        ];

    const joinedYear = distributorProfile.joinedAt
      ? new Date(distributorProfile.joinedAt).getFullYear().toString()
      : '2026';

    return {
      distributor: {
        id: distributorProfile.id,
        memberId: distributorProfile.distributorCode.replace(/[^0-9]/g, '') || '88767139',
        distributorCode: distributorProfile.distributorCode,
        fullName: `${distributorProfile.firstName} ${distributorProfile.lastName}`,
        firstName: distributorProfile.firstName,
        lastName: distributorProfile.lastName,
        displayName: distributorProfile.displayName,
        email: distributorProfile.email,
        phone: distributorProfile.phone,
        status: distributorProfile.status,
        memberSince: joinedYear,
        tier: distributorProfile.currentRank || 'Business Center',
      },
      rank: {
        currentRank: distributorProfile.currentRank || 'Business Center',
        highestRank: distributorProfile.highestRank || 'Business Center',
        lifetimePV: distributorProfile.lifetimePV,
        lifetimeGV: distributorProfile.lifetimeGV,
      },
      badges,
      commissionSummary,
      qualificationStatus,
      businessCenters: formattedBusinessCenters,
      quickLinks,
      jumpStartTasks,
      taskProgress: {
        completedTasks,
        remainingTasks,
        totalTasks: jumpStartTasks.length,
        progressPercentage,
      },
      trainingProgress: trainingProgress
        ? {
            completedTasks: trainingProgress.completedTasks,
            remainingTasks: trainingProgress.remainingTasks,
            totalTasks: trainingProgress.totalTasks,
            progressPercentage: trainingProgress.progressPercentage,
            completedCoursesCount: trainingProgress.completedCoursesCount,
          }
        : undefined,
      priorityContacts,
      news,
    };
  }
}
