export class TrainingService {
  static async getModules(memberId?: string) {
    return [
      {
        code: 'ORIENTATION',
        title: 'Associate Orientation Masterclass',
        category: 'Getting Started',
        durationMinutes: 10,
        desc: 'Comprehensive walk-through of Business Center placement, CVP calculation, and autoship benefits.',
        isCompleted: true,
      },
      {
        code: 'ETHICS',
        title: 'Ethics & Truthful Claims Certification',
        category: 'Compliance',
        durationMinutes: 20,
        desc: 'Learn compliant advertising standards, social media disclaimers, and honest representation of earnings.',
        isCompleted: true,
      },
      {
        code: 'CONNECT_SHARING',
        title: 'Social Sharing with KASHVIMLM Connect',
        category: 'Sales Strategy',
        durationMinutes: 15,
        desc: 'How to send curated product baskets, generate personalized links, and follow up with interested prospects.',
        isCompleted: false,
      },
      {
        code: 'COMPENSATION_PLAN',
        title: 'Binary Compensation & Rank Mastery',
        category: 'Business Growth',
        durationMinutes: 30,
        desc: 'Deep dive into binary matching, weaker leg optimization, carryover banking, and Pacesetter incentives.',
        isCompleted: false,
      },
    ];
  }

  static async completeModule(memberId: string, moduleCode: string) {
    return {
      success: true,
      memberId,
      moduleCode,
      status: 'Completed',
      certificateUrl: `https://kashvimlm.com/certificates/${memberId}_${moduleCode}.pdf`,
    };
  }
}
