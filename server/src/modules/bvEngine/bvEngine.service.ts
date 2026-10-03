import { query } from '../../config/db.js';

export class BvEngineService {
  static async getVolumeSummary(memberId: string) {
    const distRes = await query('SELECT id, member_id, full_name, current_psv, lifetime_bv, qualification_status FROM distributors WHERE member_id = $1', [
      memberId,
    ]);
    const dist = distRes.rows[0] || {
      id: 'demo-dist-id',
      member_id: memberId,
      full_name: 'Rahul kaushal',
      current_psv: '120.00',
      lifetime_bv: '14500.00',
      qualification_status: 'Active'
    };

    // Weekly cycle numbers
    const currentWeek = 38;
    const currentYear = 2026;

    const summary = {
      memberId: dist.member_id,
      fullName: dist.full_name,
      qualificationStatus: dist.qualification_status,
      cycleWeek: `Week ${currentWeek}, ${currentYear}`,
      cutoffDeadline: 'Friday 11:59 PM IST',
      personalSalesVolume: parseFloat(dist.current_psv),
      isQualifiedForMatching: parseFloat(dist.current_psv) >= 100,
      businessCenters: {
        bc001: {
          leftLegVolume: 1250,
          rightLegVolume: 1890,
          weakerLeg: 'Left (1,250 BV)',
          matchedVolume: 1250,
          carryoverLeft: 0,
          carryoverRight: 640,
        },
        bc002: {
          leftLegVolume: 580,
          rightLegVolume: 670,
          weakerLeg: 'Left (580 BV)',
          matchedVolume: 580,
          carryoverLeft: 0,
          carryoverRight: 90,
        },
        bc003: {
          leftLegVolume: 890,
          rightLegVolume: 1000,
          weakerLeg: 'Left (890 BV)',
          matchedVolume: 890,
          carryoverLeft: 0,
          carryoverRight: 110,
        },
      },
      lifetimeVolume: parseFloat(dist.lifetime_bv),
    };

    return summary;
  }

  static async getLedgerHistory(memberId: string, limit = 20) {
    const distRes = await query('SELECT id FROM distributors WHERE member_id = $1', [memberId]);
    if (distRes.rows.length === 0) {
      return [];
    }
    const distId = distRes.rows[0].id;

    const res = await query(
      `SELECT * FROM bv_ledger
       WHERE distributor_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [distId, limit]
    );
    return res.rows;
  }
}
