import { test, expect } from '@playwright/test';

test.describe('MLM Level System, Rank Qualification & Commission Percentages Suite', () => {
  test('TC-LEVEL-01: Public levels and ranks configuration endpoint exposes correct percentages, BVs and matching thresholds', async ({ request }) => {
    // 1. Check /api/v1/levels/config
    const resLevels = await request.get('http://localhost:5001/api/v1/levels/config');
    expect(resLevels.status()).toBe(200);
    const jsonLevels = await resLevels.json();
    expect(jsonLevels.success).toBe(true);

    const levels = jsonLevels.data;
    const silver = levels.find((l) => l.name === 'Silver');
    const gold = levels.find((l) => l.name === 'Gold');
    const platinum = levels.find((l) => l.name === 'Platinum');
    const diamond = levels.find((l) => l.name === 'Diamond');
    const ruby = levels.find((l) => l.name === 'Ruby');

    // Silver: 24% | 250 BV | min 2000 matching left or right
    expect(silver).toBeDefined();
    expect(silver.commissionPercent).toBe(24);
    expect(silver.requiredBB).toBe(250);
    expect(silver.requiredLeftMatching).toBe(2000);
    expect(silver.requiredRightMatching).toBe(2000);

    // Gold: 8% | 250 BV | min 5000 matching left or right
    expect(gold).toBeDefined();
    expect(gold.commissionPercent).toBe(8);
    expect(gold.requiredBB).toBe(250);
    expect(gold.requiredLeftMatching).toBe(5000);
    expect(gold.requiredRightMatching).toBe(5000);

    // Platinum: 13% | 500 BV | min 50000 matching left or right
    expect(platinum).toBeDefined();
    expect(platinum.commissionPercent).toBe(13);
    expect(platinum.requiredBB).toBe(500);
    expect(platinum.requiredLeftMatching).toBe(50000);
    expect(platinum.requiredRightMatching).toBe(50000);

    // Diamond: 5% | 1000 BV | min 60000 matching left or right
    expect(diamond).toBeDefined();
    expect(diamond.commissionPercent).toBe(5);
    expect(diamond.requiredBB).toBe(1000);
    expect(diamond.requiredLeftMatching).toBe(60000);
    expect(diamond.requiredRightMatching).toBe(60000);

    // Ruby: 4% | 1000 BV | min 100000 matching left or right
    expect(ruby).toBeDefined();
    expect(ruby.commissionPercent).toBe(4);
    expect(ruby.requiredBB).toBe(1000);
    expect(ruby.requiredLeftMatching).toBe(100000);
    expect(ruby.requiredRightMatching).toBe(100000);

    // 2. Check /api/v1/commissions/cumulative/ranks
    const resRanks = await request.get('http://localhost:5001/api/v1/commissions/cumulative/ranks');
    expect(resRanks.status()).toBe(200);
    const jsonRanks = await resRanks.json();
    const rankSilver = jsonRanks.data.find((r) => r.name === 'Silver');
    expect(rankSilver.commissionPercent).toBe(24);
  });

  test('TC-LEVEL-02: Admin user level increases based on joinings under him without requiring personal buying (BV)', async ({ request }) => {
    // 1. With 2 joinings under admin, level increases to Silver (24%) with 0 BV
    const resSilver = await request.post('http://localhost:5001/api/v1/levels/evaluate', {
      data: {
        role: 'ADMIN',
        distributorCode: 'KV-1001',
        currentBB: 0,
        joinings: 2,
      },
    });
    expect(resSilver.status()).toBe(200);
    const evalSilver = (await resSilver.json()).data;
    expect(evalSilver.eligibleLevel.name).toBe('Silver');
    expect(evalSilver.eligibleLevel.commissionPercent).toBe(24);

    // 2. With 5 joinings under admin, level increases to Gold (8%) with 0 BV
    const resGold = await request.post('http://localhost:5001/api/v1/levels/evaluate', {
      data: {
        role: 'ADMIN',
        distributorCode: 'KV-1001',
        currentBB: 0,
        joinings: 5,
      },
    });
    expect(resGold.status()).toBe(200);
    const evalGold = (await resGold.json()).data;
    expect(evalGold.eligibleLevel.name).toBe('Gold');
    expect(evalGold.eligibleLevel.commissionPercent).toBe(8);

    // 3. With 10 joinings under admin, level increases to Platinum (13%) with 0 BV
    const resPlatinum = await request.post('http://localhost:5001/api/v1/levels/evaluate', {
      data: {
        role: 'ADMIN',
        distributorCode: 'KV-1001',
        currentBB: 0,
        joinings: 10,
      },
    });
    expect(resPlatinum.status()).toBe(200);
    const evalPlatinum = (await resPlatinum.json()).data;
    expect(evalPlatinum.eligibleLevel.name).toBe('Platinum');
    expect(evalPlatinum.eligibleLevel.commissionPercent).toBe(13);

    // 4. With 20 joinings under admin, level increases to Diamond (5%) with 0 BV
    const resDiamond = await request.post('http://localhost:5001/api/v1/levels/evaluate', {
      data: {
        role: 'ADMIN',
        distributorCode: 'KV-1001',
        currentBB: 0,
        joinings: 20,
      },
    });
    expect(resDiamond.status()).toBe(200);
    const evalDiamond = (await resDiamond.json()).data;
    expect(evalDiamond.eligibleLevel.name).toBe('Diamond');
    expect(evalDiamond.eligibleLevel.commissionPercent).toBe(5);

    // 5. With 50 joinings under admin, level increases to Ruby (4%) with 0 BV
    const resRuby = await request.post('http://localhost:5001/api/v1/levels/evaluate', {
      data: {
        role: 'ADMIN',
        distributorCode: 'KV-1001',
        currentBB: 0,
        joinings: 50,
      },
    });
    expect(resRuby.status()).toBe(200);
    const evalRuby = (await resRuby.json()).data;
    expect(evalRuby.eligibleLevel.name).toBe('Ruby');
    expect(evalRuby.eligibleLevel.commissionPercent).toBe(4);
  });

  test('TC-LEVEL-03: Distributor level increases ONLY when distributor buys personal BV AND adds people (matching at left or right)', async ({ request }) => {
    // Scenario A: Distributor added people (2000 matching on left) but did NOT buy BV (0 BV) -> Fails Silver
    const resNoBuy = await request.post('http://localhost:5001/api/v1/levels/evaluate', {
      data: {
        role: 'DISTRIBUTOR',
        distributorCode: 'DST-99999',
        currentBB: 0,
        leftMatching: 2000,
        rightMatching: 0,
      },
    });
    expect(resNoBuy.status()).toBe(200);
    const evalNoBuy = (await resNoBuy.json()).data;
    expect(evalNoBuy.eligibleLevel.name).not.toBe('Silver');
    expect(evalNoBuy.eligibleLevel.order).toBe(0); // Remains Base

    // Scenario B: Distributor bought 250 BV but did NOT add people (0 matching) -> Fails Silver
    const resNoPeople = await request.post('http://localhost:5001/api/v1/levels/evaluate', {
      data: {
        role: 'DISTRIBUTOR',
        distributorCode: 'DST-99999',
        currentBB: 250,
        leftMatching: 0,
        rightMatching: 0,
      },
    });
    expect(resNoPeople.status()).toBe(200);
    const evalNoPeople = (await resNoPeople.json()).data;
    expect(evalNoPeople.eligibleLevel.name).not.toBe('Silver');
    expect(evalNoPeople.eligibleLevel.order).toBe(0); // Remains Base

    // Scenario C: Distributor bought 250 BV AND added people (min 2000 matching at left) -> Qualifies Silver (24%)
    const resSilverLeft = await request.post('http://localhost:5001/api/v1/levels/evaluate', {
      data: {
        role: 'DISTRIBUTOR',
        distributorCode: 'DST-99999',
        currentBB: 250,
        leftMatching: 2000,
        rightMatching: 0,
      },
    });
    expect(resSilverLeft.status()).toBe(200);
    const evalSilverLeft = (await resSilverLeft.json()).data;
    expect(evalSilverLeft.eligibleLevel.name).toBe('Silver');
    expect(evalSilverLeft.eligibleLevel.commissionPercent).toBe(24);

    // Scenario D: Distributor bought 250 BV AND added people (min 2000 matching at right) -> Qualifies Silver (24%)
    const resSilverRight = await request.post('http://localhost:5001/api/v1/levels/evaluate', {
      data: {
        role: 'DISTRIBUTOR',
        distributorCode: 'DST-99999',
        currentBB: 250,
        leftMatching: 0,
        rightMatching: 2000,
      },
    });
    expect(resSilverRight.status()).toBe(200);
    const evalSilverRight = (await resSilverRight.json()).data;
    expect(evalSilverRight.eligibleLevel.name).toBe('Silver');
    expect(evalSilverRight.eligibleLevel.commissionPercent).toBe(24);

    // Scenario E: Distributor bought 250 BV AND added people (5000 matching at right) -> Qualifies Gold (8%)
    const resGold = await request.post('http://localhost:5001/api/v1/levels/evaluate', {
      data: {
        role: 'DISTRIBUTOR',
        distributorCode: 'DST-99999',
        currentBB: 250,
        leftMatching: 0,
        rightMatching: 5000,
      },
    });
    expect(resGold.status()).toBe(200);
    const evalGold = (await resGold.json()).data;
    expect(evalGold.eligibleLevel.name).toBe('Gold');
    expect(evalGold.eligibleLevel.commissionPercent).toBe(8);

    // Scenario F: Distributor bought 500 BV AND 50000 matching at left -> Qualifies Platinum (13%)
    const resPlatinum = await request.post('http://localhost:5001/api/v1/levels/evaluate', {
      data: {
        role: 'DISTRIBUTOR',
        distributorCode: 'DST-99999',
        currentBB: 500,
        leftMatching: 50000,
        rightMatching: 0,
      },
    });
    expect(resPlatinum.status()).toBe(200);
    const evalPlatinum = (await resPlatinum.json()).data;
    expect(evalPlatinum.eligibleLevel.name).toBe('Platinum');
    expect(evalPlatinum.eligibleLevel.commissionPercent).toBe(13);

    // Scenario G: Distributor bought 1000 BV AND 60000 matching at right -> Qualifies Diamond (5%)
    const resDiamond = await request.post('http://localhost:5001/api/v1/levels/evaluate', {
      data: {
        role: 'DISTRIBUTOR',
        distributorCode: 'DST-99999',
        currentBB: 1000,
        leftMatching: 0,
        rightMatching: 60000,
      },
    });
    expect(resDiamond.status()).toBe(200);
    const evalDiamond = (await resDiamond.json()).data;
    expect(evalDiamond.eligibleLevel.name).toBe('Diamond');
    expect(evalDiamond.eligibleLevel.commissionPercent).toBe(5);

    // Scenario H: Distributor bought 1000 BV AND 100000 matching at left -> Qualifies Ruby (4%)
    const resRuby = await request.post('http://localhost:5001/api/v1/levels/evaluate', {
      data: {
        role: 'DISTRIBUTOR',
        distributorCode: 'DST-99999',
        currentBB: 1000,
        leftMatching: 100000,
        rightMatching: 0,
      },
    });
    expect(resRuby.status()).toBe(200);
    const evalRuby = (await resRuby.json()).data;
    expect(evalRuby.eligibleLevel.name).toBe('Ruby');
    expect(evalRuby.eligibleLevel.commissionPercent).toBe(4);
  });

  test('TC-LEVEL-04: Registering new joinings under tree updates upline level processing', async ({ request }) => {
    // Register a new member using Admin (KV-1001) as sponsor
    const mobile = `93${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regRes = await request.post('http://localhost:5001/api/auth/register', {
      data: {
        fullName: 'Level Test Joined Member',
        phone: mobile,
        password: 'Password123',
        confirmPassword: 'Password123',
        referralCode: 'KV-1001',
      },
    });

    expect(regRes.status()).toBe(201);
    const regJson = await regRes.json();
    expect(regJson.success).toBe(true);
  });
});
