import { TrainingCourseCategory } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { TrainingCourseQueryInput } from '../validators/training.validators';

export interface FormattedLesson {
  id: string;
  courseId: string;
  title: string;
  content: string;
  videoUrl: string | null;
  durationMinutes: number;
  displayOrder: number;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED';
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface FormattedCourse {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: TrainingCourseCategory;
  thumbnailUrl: string | null;
  isMandatory: boolean;
  displayOrder: number;
  totalLessons: number;
  completedLessons: number;
  progressPercentage: number;
  isCompleted: boolean;
  lessons?: FormattedLesson[];
}

export interface OverallTrainingProgress {
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  progressPercentage: number;
  completedCoursesCount: number;
  totalCoursesCount: number;
  categories: Record<
    TrainingCourseCategory,
    {
      totalTasks: number;
      completedTasks: number;
      remainingTasks: number;
      progressPercentage: number;
      isCompleted: boolean;
    }
  >;
}

export class TrainingService {
  /**
   * Ensures essential default courses across all categories are seeded in the database.
   */
  public static async ensureDefaultCourses(): Promise<void> {
    const existingCount = await prisma.trainingCourse.count();
    if (existingCount > 0) return;

    const defaultCourses = [
      {
        slug: 'associate-orientation',
        title: 'New Associate Orientation & Binary Plan Fundamentals',
        description: 'Discover how KASHVIMLM binary compensation works, learn placement strategy, and tour your back-office.',
        category: 'ORIENTATION' as TrainingCourseCategory,
        isMandatory: true,
        displayOrder: 1,
        lessons: [
          {
            title: 'Welcome to KASHVIMLM & The Binary Advantage',
            content: 'Overview of company vision, binary placement rules, and your primary business center.',
            durationMinutes: 10,
            displayOrder: 1,
          },
          {
            title: 'Understanding Business Volume (BV) & Commission Cycles',
            content: 'Deep dive into 1/3-2/3 volume balancing, cycle checks, and carryover rules.',
            durationMinutes: 15,
            displayOrder: 2,
          },
        ],
      },
      {
        slug: 'business-setup-hub',
        title: 'Setting Up Your Replicated Website & Business Hub',
        description: 'Personalize your replicated e-store, set up payment methods, and configure notifications.',
        category: 'BUSINESS_SETUP' as TrainingCourseCategory,
        isMandatory: true,
        displayOrder: 2,
        lessons: [
          {
            title: 'Configuring Your Digital Storefront Subdomain',
            content: 'How to customize your URL, profile avatar, and featured products catalog.',
            durationMinutes: 8,
            displayOrder: 1,
          },
          {
            title: 'Setting Up SMS Notifications & Security PIN',
            content: 'Enable two-factor security and instant commission SMS alerts.',
            durationMinutes: 5,
            displayOrder: 2,
          },
        ],
      },
      {
        slug: 'product-catalog-mastery',
        title: 'Product Knowledge & Wellness Catalog Mastery',
        description: 'Comprehensive guide to premium apparel, smart devices, retail pricing, and BV values.',
        category: 'PRODUCT' as TrainingCourseCategory,
        isMandatory: false,
        displayOrder: 3,
        lessons: [
          {
            title: 'Apparel & Hosiery Line Specifications',
            content: 'Fabric technology, sizes, wholesale discounts, and customer presentation scripts.',
            durationMinutes: 12,
            displayOrder: 1,
          },
          {
            title: 'Smart Electronics & Connected Devices',
            content: 'Technical specifications, warranty process, and cross-selling strategies.',
            durationMinutes: 14,
            displayOrder: 2,
          },
        ],
      },
      {
        slug: 'ethics-and-compliance',
        title: 'Direct Selling Compliance, Standards & Ethics Certification',
        description: 'Understand direct selling laws, honest advertising, customer return policies, and income disclaimers.',
        category: 'ETHICS' as TrainingCourseCategory,
        isMandatory: true,
        displayOrder: 4,
        lessons: [
          {
            title: 'Truth in Advertising & Income Claim Restrictions',
            content: 'Mandatory guidelines on earnings disclaimers, testimonials, and marketing rules.',
            durationMinutes: 15,
            displayOrder: 1,
          },
          {
            title: 'Anti-Spam, Customer Privacy & KYC Standards',
            content: 'Complying with data protection laws, consumer refund guarantees, and KYC verification.',
            durationMinutes: 10,
            displayOrder: 2,
          },
        ],
      },
      {
        slug: 'digital-marketing-funnels',
        title: 'Digital Prospecting & Social Media Marketing',
        description: 'Proven strategies for social sharing, generating warm leads, and building your customer base.',
        category: 'MARKETING' as TrainingCourseCategory,
        isMandatory: false,
        displayOrder: 5,
        lessons: [
          {
            title: 'Social Media Prospecting Scripts & Storytelling',
            content: 'Effective Instagram, LinkedIn, and WhatsApp engagement strategies.',
            durationMinutes: 20,
            displayOrder: 1,
          },
        ],
      },
      {
        slug: 'team-manager-tools',
        title: 'Team Manager Portal & Analytics Tools',
        description: 'Learn how to read genealogy trees, trace leg volume, and export payout records.',
        category: 'TOOLS' as TrainingCourseCategory,
        isMandatory: false,
        displayOrder: 6,
        lessons: [
          {
            title: 'Navigating The Binary Tree & Placement Queue',
            content: 'How to place new enrollments into open left or right positions within the 72-hour window.',
            durationMinutes: 12,
            displayOrder: 1,
          },
        ],
      },
    ];

    for (const c of defaultCourses) {
      await prisma.trainingCourse.create({
        data: {
          slug: c.slug,
          title: c.title,
          description: c.description,
          category: c.category,
          isMandatory: c.isMandatory,
          displayOrder: c.displayOrder,
          lessons: {
            create: c.lessons.map((l) => ({
              title: l.title,
              content: l.content,
              durationMinutes: l.durationMinutes,
              displayOrder: l.displayOrder,
            })),
          },
        },
      });
    }

    logger.info('Default training courses and lessons initialized successfully');
  }

  /**
   * Retrieves all courses with the user's progress and category filters.
   */
  public static async getCourses(
    userId: string,
    query?: TrainingCourseQueryInput
  ): Promise<FormattedCourse[]> {
    await this.ensureDefaultCourses();

    const distributor = await prisma.distributorProfile.findUnique({
      where: { userId },
    });

    const whereClause: any = {};
    if (query?.category) {
      whereClause.category = query.category;
    }
    if (query?.isMandatory !== undefined) {
      whereClause.isMandatory = query.isMandatory;
    }
    if (query?.search) {
      whereClause.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const courses = await prisma.trainingCourse.findMany({
      where: whereClause,
      include: {
        lessons: {
          orderBy: { displayOrder: 'asc' },
          include: {
            progress: distributor
              ? { where: { distributorId: distributor.id } }
              : false,
          },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    return courses.map((course) => {
      const totalLessons = course.lessons.length;
      let completedLessons = 0;

      const formattedLessons: FormattedLesson[] = course.lessons.map((lesson) => {
        const prog = Array.isArray(lesson.progress) ? lesson.progress[0] : null;
        const isCompleted = Boolean(prog?.isCompleted);
        if (isCompleted) completedLessons++;

        let status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED' = 'NOT_STARTED';
        if (isCompleted) {
          status = 'COMPLETED';
        } else if (prog?.startedAt || prog) {
          status = 'IN_PROGRESS';
        }

        return {
          id: lesson.id,
          courseId: lesson.courseId,
          title: lesson.title,
          content: lesson.content,
          videoUrl: lesson.videoUrl,
          durationMinutes: lesson.durationMinutes,
          displayOrder: lesson.displayOrder,
          status,
          startedAt: prog?.startedAt ?? null,
          completedAt: prog?.completedAt ?? null,
        };
      });

      const progressPercentage =
        totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      const isCompleted = totalLessons > 0 && completedLessons === totalLessons;

      return {
        id: course.id,
        slug: course.slug,
        title: course.title,
        description: course.description,
        category: course.category,
        thumbnailUrl: course.thumbnailUrl,
        isMandatory: course.isMandatory,
        displayOrder: course.displayOrder,
        totalLessons,
        completedLessons,
        progressPercentage,
        isCompleted,
        lessons: formattedLessons,
      };
    });
  }

  /**
   * Retrieves single course with detailed lessons and progress for the authenticated user.
   */
  public static async getCourseById(
    userId: string,
    courseIdOrSlug: string
  ): Promise<FormattedCourse> {
    await this.ensureDefaultCourses();

    const distributor = await prisma.distributorProfile.findUnique({
      where: { userId },
    });

    const course = await prisma.trainingCourse.findFirst({
      where: {
        OR: [{ id: courseIdOrSlug }, { slug: courseIdOrSlug }],
      },
      include: {
        lessons: {
          orderBy: { displayOrder: 'asc' },
          include: {
            progress: distributor
              ? { where: { distributorId: distributor.id } }
              : false,
          },
        },
      },
    });

    if (!course) {
      throw AppError.notFound('Training course not found.', 'COURSE_NOT_FOUND');
    }

    const totalLessons = course.lessons.length;
    let completedLessons = 0;

    const formattedLessons: FormattedLesson[] = course.lessons.map((lesson) => {
      const prog = Array.isArray(lesson.progress) ? lesson.progress[0] : null;
      const isCompleted = Boolean(prog?.isCompleted);
      if (isCompleted) completedLessons++;

      let status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED' = 'NOT_STARTED';
      if (isCompleted) {
        status = 'COMPLETED';
      } else if (prog?.startedAt || prog) {
        status = 'IN_PROGRESS';
      }

      return {
        id: lesson.id,
        courseId: lesson.courseId,
        title: lesson.title,
        content: lesson.content,
        videoUrl: lesson.videoUrl,
        durationMinutes: lesson.durationMinutes,
        displayOrder: lesson.displayOrder,
        status,
        startedAt: prog?.startedAt ?? null,
        completedAt: prog?.completedAt ?? null,
      };
    });

    const progressPercentage =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    const isCompleted = totalLessons > 0 && completedLessons === totalLessons;

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      category: course.category,
      thumbnailUrl: course.thumbnailUrl,
      isMandatory: course.isMandatory,
      displayOrder: course.displayOrder,
      totalLessons,
      completedLessons,
      progressPercentage,
      isCompleted,
      lessons: formattedLessons,
    };
  }

  /**
   * Marks a lesson as started.
   */
  public static async startLesson(
    userId: string,
    courseIdOrSlug: string,
    lessonId: string
  ): Promise<{ message: string; lesson: FormattedLesson; courseProgress: number }> {
    const distributor = await prisma.distributorProfile.findUnique({
      where: { userId },
    });
    if (!distributor) {
      throw AppError.notFound('Distributor profile not found.', 'DISTRIBUTOR_NOT_FOUND');
    }

    // Verify course & lesson
    const lesson = await prisma.trainingLesson.findFirst({
      where: {
        id: lessonId,
        course: {
          OR: [{ id: courseIdOrSlug }, { slug: courseIdOrSlug }],
        },
      },
      include: { course: true },
    });

    if (!lesson) {
      throw AppError.notFound('Lesson not found in specified course.', 'LESSON_NOT_FOUND');
    }

    const progress = await prisma.trainingProgress.upsert({
      where: {
        distributorId_lessonId: {
          distributorId: distributor.id,
          lessonId: lesson.id,
        },
      },
      create: {
        distributorId: distributor.id,
        lessonId: lesson.id,
        isCompleted: false,
        startedAt: new Date(),
      },
      update: {
        startedAt: new Date(),
      },
    });

    const courseDetails = await this.getCourseById(userId, lesson.courseId);

    return {
      message: 'Lesson started successfully.',
      lesson: {
        id: lesson.id,
        courseId: lesson.courseId,
        title: lesson.title,
        content: lesson.content,
        videoUrl: lesson.videoUrl,
        durationMinutes: lesson.durationMinutes,
        displayOrder: lesson.displayOrder,
        status: progress.isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
        startedAt: progress.startedAt,
        completedAt: progress.completedAt,
      },
      courseProgress: courseDetails.progressPercentage,
    };
  }

  /**
   * Marks a lesson as completed.
   */
  public static async completeLesson(
    userId: string,
    courseIdOrSlug: string,
    lessonId: string
  ): Promise<{ message: string; lesson: FormattedLesson; courseProgress: number; isCourseCompleted: boolean }> {
    const distributor = await prisma.distributorProfile.findUnique({
      where: { userId },
    });
    if (!distributor) {
      throw AppError.notFound('Distributor profile not found.', 'DISTRIBUTOR_NOT_FOUND');
    }

    const lesson = await prisma.trainingLesson.findFirst({
      where: {
        id: lessonId,
        course: {
          OR: [{ id: courseIdOrSlug }, { slug: courseIdOrSlug }],
        },
      },
      include: { course: true },
    });

    if (!lesson) {
      throw AppError.notFound('Lesson not found in specified course.', 'LESSON_NOT_FOUND');
    }

    const progress = await prisma.trainingProgress.upsert({
      where: {
        distributorId_lessonId: {
          distributorId: distributor.id,
          lessonId: lesson.id,
        },
      },
      create: {
        distributorId: distributor.id,
        lessonId: lesson.id,
        isCompleted: true,
        startedAt: new Date(),
        completedAt: new Date(),
      },
      update: {
        isCompleted: true,
        completedAt: new Date(),
      },
    });

    const courseDetails = await this.getCourseById(userId, lesson.courseId);

    logger.info(
      { distributorId: distributor.id, lessonId: lesson.id, courseId: lesson.courseId },
      'Training lesson marked as completed'
    );

    return {
      message: 'Lesson completed successfully.',
      lesson: {
        id: lesson.id,
        courseId: lesson.courseId,
        title: lesson.title,
        content: lesson.content,
        videoUrl: lesson.videoUrl,
        durationMinutes: lesson.durationMinutes,
        displayOrder: lesson.displayOrder,
        status: 'COMPLETED',
        startedAt: progress.startedAt,
        completedAt: progress.completedAt,
      },
      courseProgress: courseDetails.progressPercentage,
      isCourseCompleted: courseDetails.isCompleted,
    };
  }

  /**
   * Calculates overall user training progress:
   * completed tasks, remaining tasks, progress percentage, and category breakdown.
   */
  public static async getProgress(userId: string): Promise<OverallTrainingProgress> {
    await this.ensureDefaultCourses();

    const distributor = await prisma.distributorProfile.findUnique({
      where: { userId },
    });

    const allCourses = await prisma.trainingCourse.findMany({
      include: {
        lessons: {
          include: {
            progress: distributor
              ? { where: { distributorId: distributor.id } }
              : false,
          },
        },
      },
    });

    let totalTasks = 0;
    let completedTasks = 0;
    let completedCoursesCount = 0;

    const categories: Record<TrainingCourseCategory, any> = {
      ORIENTATION: { totalTasks: 0, completedTasks: 0, remainingTasks: 0, progressPercentage: 0, isCompleted: false },
      BUSINESS_SETUP: { totalTasks: 0, completedTasks: 0, remainingTasks: 0, progressPercentage: 0, isCompleted: false },
      PRODUCT: { totalTasks: 0, completedTasks: 0, remainingTasks: 0, progressPercentage: 0, isCompleted: false },
      ETHICS: { totalTasks: 0, completedTasks: 0, remainingTasks: 0, progressPercentage: 0, isCompleted: false },
      MARKETING: { totalTasks: 0, completedTasks: 0, remainingTasks: 0, progressPercentage: 0, isCompleted: false },
      TOOLS: { totalTasks: 0, completedTasks: 0, remainingTasks: 0, progressPercentage: 0, isCompleted: false },
    };

    for (const course of allCourses) {
      const courseLessons = course.lessons.length;
      let courseCompleted = 0;

      for (const lesson of course.lessons) {
        totalTasks++;
        categories[course.category].totalTasks++;

        const prog = Array.isArray(lesson.progress) ? lesson.progress[0] : null;
        if (prog?.isCompleted) {
          completedTasks++;
          courseCompleted++;
          categories[course.category].completedTasks++;
        }
      }

      if (courseLessons > 0 && courseCompleted === courseLessons) {
        completedCoursesCount++;
      }
    }

    const remainingTasks = Math.max(0, totalTasks - completedTasks);
    const progressPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Calculate percentages per category
    for (const cat of Object.keys(categories) as TrainingCourseCategory[]) {
      const c = categories[cat];
      c.remainingTasks = Math.max(0, c.totalTasks - c.completedTasks);
      c.progressPercentage =
        c.totalTasks > 0 ? Math.round((c.completedTasks / c.totalTasks) * 100) : 0;
      c.isCompleted = c.totalTasks > 0 && c.completedTasks === c.totalTasks;
    }

    return {
      totalTasks,
      completedTasks,
      remainingTasks,
      progressPercentage,
      completedCoursesCount,
      totalCoursesCount: allCourses.length,
      categories,
    };
  }
}
