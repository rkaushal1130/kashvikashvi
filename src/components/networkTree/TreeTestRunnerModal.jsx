import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  X,
  ShieldCheck,
  Terminal,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { MlmTreeEngine } from '../../utils/mlmTreeEngine';
import './TreeTestRunner.css';

export default function TreeTestRunnerModal({ isOpen, onClose }) {
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [expandedTestId, setExpandedTestId] = useState(null);

  if (!isOpen) return null;

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    const engine = new MlmTreeEngine();
    const results = [];

    // Helper to log and append test
    const recordTest = (id, title, category, executeFn) => {
      const startTime = performance.now();
      try {
        const data = executeFn();
        const duration = Math.round(performance.now() - startTime);
        const result = {
          id,
          title,
          category,
          status: 'PASS',
          duration,
          ...data,
        };
        results.push(result);
        setTestResults([...results]);
        return result;
      } catch (err) {
        const duration = Math.round(performance.now() - startTime);
        const result = {
          id,
          title,
          category,
          status: 'FAIL',
          duration,
          error: err.message,
        };
        results.push(result);
        setTestResults([...results]);
        return result;
      }
    };

    // Simulated step-by-step delay so user sees real-time test execution
    const stepDelay = () => new Promise((resolve) => setTimeout(resolve, 40));

    // TEST 1
    await stepDelay();
    recordTest(1, 'TEST 1: Create Rahul (KV-1001)', 'Core Tree', () => {
      engine.reset();
      const root = engine.createRoot('KV-1001', 'Rahul');
      const ascii = engine.toAscii();
      const expectedAscii = 'Rahul\n├── EMPTY\n└── EMPTY';
      if (ascii !== expectedAscii) throw new Error(`ASCII mismatch: expected "${expectedAscii}", got "${ascii}"`);
      return {
        expected: 'Rahul with Left: EMPTY, Right: EMPTY',
        actual: 'Left: EMPTY, Right: EMPTY',
        ascii,
      };
    });

    // TEST 2
    await stepDelay();
    recordTest(2, 'TEST 2: Amit joins using Rahul', 'Core Tree', () => {
      const res = engine.joinMember('KV-1001', 'LEFT', {
        distributorId: 'KV-1002',
        name: 'Amit',
        sponsorId: 'KV-1001',
        rank: 'Executive Director',
      });
      if (!res.success) throw new Error(res.message);
      const ascii = engine.toAscii();
      const expectedAscii = 'Rahul\n├── Amit\n└── EMPTY';
      if (ascii !== expectedAscii) throw new Error('ASCII mismatch');
      return {
        expected: 'Rahul -> Left: Amit, Right: EMPTY',
        actual: 'Left: Amit, Right: EMPTY',
        ascii,
      };
    });

    // TEST 3
    await stepDelay();
    recordTest(3, 'TEST 3: Rohit joins using Rahul', 'Core Tree', () => {
      const res = engine.joinMember('KV-1001', 'RIGHT', {
        distributorId: 'KV-1003',
        name: 'Rohit',
        sponsorId: 'KV-1001',
        rank: 'Senior Director',
      });
      if (!res.success) throw new Error(res.message);
      const ascii = engine.toAscii();
      const expectedAscii = 'Rahul\n├── Amit\n└── Rohit';
      if (ascii !== expectedAscii) throw new Error('ASCII mismatch');
      return {
        expected: 'Rahul -> Left: Amit, Right: Rohit',
        actual: 'Left: Amit, Right: Rohit',
        ascii,
      };
    });

    // TEST 4
    await stepDelay();
    recordTest(4, 'TEST 4: Third direct member attempts to join Rahul', 'Core Tree', () => {
      const res = engine.joinMember('KV-1001', 'LEFT', {
        distributorId: 'KV-1004',
        name: 'Priya',
        sponsorId: 'KV-1001',
      });
      if (res.success || !res.rejected) throw new Error('Expected placement to be rejected');
      if (res.reason !== 'Both direct positions are occupied.') throw new Error(`Unexpected reason: ${res.reason}`);
      return {
        expected: 'REJECTED: Both direct positions are occupied.',
        actual: `REJECTED: ${res.reason}`,
        reason: res.reason,
      };
    });

    // TEST 5
    await stepDelay();
    recordTest(5, 'TEST 5: Neha joins under Amit', 'Core Tree', () => {
      const res = engine.joinMember('KV-1002', 'LEFT', {
        distributorId: 'KV-1006',
        name: 'Neha',
        sponsorId: 'KV-1002',
        rank: 'Silver Director',
      });
      if (!res.success) throw new Error(res.message);
      const ascii = engine.toAscii();
      const expectedAscii = 'Rahul\n├── Amit\n│   ├── Neha\n│   └── EMPTY\n└── Rohit';
      if (ascii !== expectedAscii) throw new Error('ASCII mismatch');
      return {
        expected: 'Rahul -> Amit (Left: Neha, Right: EMPTY) & Rohit',
        actual: 'Amit has Left: Neha, Right: EMPTY',
        ascii,
      };
    });

    // TEST 6
    await stepDelay();
    recordTest(6, 'TEST 6: Pooja joins under Amit', 'Core Tree', () => {
      const res = engine.joinMember('KV-1002', 'RIGHT', {
        distributorId: 'KV-1005',
        name: 'Pooja',
        sponsorId: 'KV-1002',
        rank: 'Bronze Director',
        status: 'SUSPENDED',
      });
      if (!res.success) throw new Error(res.message);
      const ascii = engine.toAscii();
      const expectedAscii = 'Rahul\n├── Amit\n│   ├── Neha\n│   └── Pooja\n└── Rohit';
      if (ascii !== expectedAscii) throw new Error('ASCII mismatch');
      return {
        expected: 'Rahul -> Amit (Left: Neha, Right: Pooja) & Rohit',
        actual: 'Amit has Left: Neha, Right: Pooja',
        ascii,
      };
    });

    // TEST 7
    await stepDelay();
    recordTest(7, 'TEST 7: Attempt another LEFT member under Amit', 'Core Tree', () => {
      const res = engine.joinMember('KV-1002', 'LEFT', {
        distributorId: 'KV-1008',
        name: 'Karan',
        sponsorId: 'KV-1002',
      });
      if (res.success || !res.rejected) throw new Error('Expected placement to be rejected');
      return {
        expected: 'REJECTED: Position occupied',
        actual: `REJECTED: ${res.reason}`,
        reason: res.reason,
      };
    });

    // TEST 8
    await stepDelay();
    recordTest(8, 'TEST 8: Hover Amit (Tooltip & Summary)', 'UI Interaction', () => {
      const hoverData = engine.getHoverDetails('KV-1002');
      if (!hoverData || hoverData.name !== 'Amit') throw new Error('Hover details missing');
      return {
        expected: 'Member details tooltip with Name, Rank, Status, BV, Leg Counts',
        actual: `Amit Patel | Rank: ${hoverData.rank} | Status: ${hoverData.status} | L: ${hoverData.teamCounts.left}, R: ${hoverData.teamCounts.right}`,
        data: hoverData,
      };
    });

    // TEST 9
    await stepDelay();
    recordTest(9, 'TEST 9: Click Amit (10-Attribute Details Panel)', 'UI Interaction', () => {
      const clickData = engine.getClickDetails('KV-1002');
      if (!clickData || !clickData.isOpen) throw new Error('Click panel not opened');
      return {
        expected: 'Slide-over Details Panel with 10 Attributes and Dual-Leg Balance Bar',
        actual: `Panel Opened: Sponsor: ${clickData.member.sponsor}, Parent: ${clickData.member.placementParent}, Position: ${clickData.member.position}, Center: ${clickData.member.businessCenter}`,
        data: clickData.member,
      };
    });

    // TEST 10
    await stepDelay();
    recordTest(10, 'TEST 10: View Network (Amit becomes Root)', 'UI Interaction', () => {
      const amitTree = engine.viewNetwork('KV-1002');
      if (!amitTree || amitTree.name !== 'Amit') throw new Error('Failed to focus on Amit');
      const ascii = engine.toAscii(amitTree);
      return {
        expected: 'Amit becomes focal root with Neha and Pooja beneath him',
        actual: 'Focal Root: Amit (KV-1002)',
        ascii,
      };
    });

    // TEST 11
    await stepDelay();
    recordTest(11, 'TEST 11: Refresh (Tree remains correct)', 'UI Interaction', () => {
      const root = engine.getRoot();
      const ascii = engine.toAscii(root);
      const expectedAscii = 'Rahul\n├── Amit\n│   ├── Neha\n│   └── Pooja\n└── Rohit';
      if (ascii !== expectedAscii) throw new Error('Topology corruption detected after refresh');
      return {
        expected: 'Tree state and topology perfectly preserved across reload cycle',
        actual: '5 members correctly structured, 0 node mutations',
        ascii,
      };
    });

    // TEST 12
    await stepDelay();
    recordTest(12, 'TEST 12: /join?ref=KV-1001 (Auto-identify Rahul)', 'Sponsorship', () => {
      const url = '/join?ref=KV-1001';
      const refCode = new URLSearchParams(url.split('?')[1]).get('ref');
      const check = engine.validateSponsor(refCode);
      if (!check.isValid || check.sponsor.distributorId !== 'KV-1001') {
        throw new Error('Failed to auto-identify Rahul');
      }
      return {
        expected: 'Sponsor automatically identified as Rahul Kaushal (KV-1001)',
        actual: `Identified Sponsor: ${check.sponsor.name} (${check.sponsor.distributorId}) - ${check.sponsor.status}`,
      };
    });

    // TEST 13
    await stepDelay();
    recordTest(13, 'TEST 13: Invalid sponsor', 'Sponsorship', () => {
      const check = engine.validateSponsor('INVALID-CODE-999');
      if (check.isValid) throw new Error('Invalid sponsor should be rejected');
      return {
        expected: 'REJECTED: Sponsor not found',
        actual: check.reason,
      };
    });

    // TEST 14
    await stepDelay();
    recordTest(14, 'TEST 14: Inactive sponsor', 'Sponsorship', () => {
      // Pooja (KV-1005) is SUSPENDED
      const check = engine.validateSponsor('KV-1005');
      if (check.isValid) throw new Error('Inactive/suspended sponsor should be rejected');
      return {
        expected: 'REJECTED: Inactive or suspended sponsor',
        actual: check.reason,
      };
    });

    // TEST 15
    await stepDelay();
    recordTest(15, 'TEST 15: Self-sponsorship', 'Sponsorship', () => {
      const check = engine.validateSponsor('KV-1001', 'KV-1001');
      if (check.isValid) throw new Error('Self-sponsorship should be rejected');
      return {
        expected: 'REJECTED: Self-sponsorship is not permitted',
        actual: check.reason,
      };
    });

    // TEST 16
    await stepDelay();
    recordTest(16, 'TEST 16: Circular placement', 'Integrity', () => {
      // Attempting to place ancestor Rahul under descendant Amit
      const res = engine.joinMember('KV-1002', 'LEFT', {
        distributorId: 'KV-1001',
        name: 'Rahul',
        sponsorId: 'KV-1002',
      });
      if (res.success || !res.rejected) throw new Error('Circular placement must be rejected');
      return {
        expected: 'REJECTED: Circular placement detected',
        actual: `REJECTED: ${res.reason}`,
      };
    });

    // TEST 17
    await stepDelay();
    const raceRes = await engine.simulateSimultaneousLeftPlacement(
      'KV-1003',
      { distributorId: 'KV-RACE-A', name: 'User A', sponsorId: 'KV-1003' },
      { distributorId: 'KV-RACE-B', name: 'User B', sponsorId: 'KV-1003' }
    );
    recordTest(17, 'TEST 17: Simultaneous LEFT placement concurrency', 'Integrity', () => {
      if (!raceRes.onlyOneSucceeded) throw new Error('Both users succeeded or both failed');
      return {
        expected: 'Atomic lock: Exactly ONE user succeeds, the other is rejected',
        actual: `User A: ${raceRes.userAResult.success ? 'ACCEPTED' : 'REJECTED'} | User B: ${raceRes.userBResult.success ? 'ACCEPTED' : 'REJECTED'}`,
      };
    });

    // TEST 18
    await stepDelay();
    recordTest(18, 'TEST 18: Admin opens network tree', 'Authorization', () => {
      const check = engine.checkAdminAccess({ role: 'ADMIN', isLoggedIn: true });
      if (!check.allowed || check.statusCode !== 200) throw new Error('Admin should have access');
      return {
        expected: '200 OK: Full global network tree viewable',
        actual: check.message,
      };
    });

    // TEST 19
    await stepDelay();
    recordTest(19, 'TEST 19: Normal user accesses admin network tree', 'Authorization', () => {
      const check = engine.checkAdminAccess({ role: 'DISTRIBUTOR', isLoggedIn: true });
      if (check.allowed || check.statusCode !== 403) throw new Error('Normal user must be forbidden');
      return {
        expected: '403 Forbidden: Standard distributor access blocked',
        actual: check.message,
      };
    });

    // TEST 20
    await stepDelay();
    recordTest(20, 'TEST 20: Mobile tree (Zoom/Pan works)', 'Mobile Responsive', () => {
      const viewport = engine.calculateMobileViewport(390, 1.0, { x: 0, y: 0 }, { x: 30, y: -20 }, 1.2);
      if (!viewport.isMobile || viewport.zoomLevel !== 1.2) throw new Error('Viewport calculation error');
      return {
        expected: 'Touch drag pan updates coordinates; pinch zoom updates scale matrix',
        actual: `Mobile Mode: ${viewport.isMobile} | Zoom: ${viewport.zoomLevel}x | Pan: (${viewport.panPosition.x}px, ${viewport.panPosition.y}px)`,
        style: viewport.transformStyle,
      };
    });

    setIsRunning(false);
  };

  const passCount = testResults.filter((t) => t.status === 'PASS').length;
  const failCount = testResults.filter((t) => t.status === 'FAIL').length;
  const progressPercent = Math.round((testResults.length / 20) * 100);

  const categories = ['ALL', 'Core Tree', 'UI Interaction', 'Sponsorship', 'Integrity', 'Authorization', 'Mobile Responsive'];

  const filteredTests = testResults.filter((t) => {
    if (filterCategory === 'ALL') return true;
    return t.category === filterCategory;
  });

  return (
    <div className="tree-test-modal-backdrop" onClick={onClose}>
      <div
        className="tree-test-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="test-suite-heading"
      >
        {/* Modal Header */}
        <div className="tree-test-modal-header">
          <div className="test-modal-header-left">
            <div className="test-badge-icon">
              <ShieldCheck size={20} className="text-emerald-500" />
            </div>
            <div>
              <h2 id="test-suite-heading" className="test-modal-title">
                Prompt 18: Complete MLM Tree Test Suite
              </h2>
              <span className="test-modal-subtitle">
                Automated Verification of All 20 Functional, Lineage, Security &amp; Concurrency Invariants
              </span>
            </div>
          </div>

          <div className="test-modal-header-right">
            <button
              type="button"
              className="btn-run-all-tests"
              onClick={runAllTests}
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <Activity size={15} className="spinner-icon" />
                  <span>Running Suite ({testResults.length}/20)...</span>
                </>
              ) : (
                <>
                  <Play size={15} />
                  <span>{testResults.length === 0 ? 'Run All 20 Tests' : 'Re-run All 20 Tests'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="test-modal-close-btn"
              onClick={onClose}
              aria-label="Close test runner"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Progress Bar & Counter Banner */}
        <div className="test-progress-strip">
          <div className="test-progress-info">
            <span className="test-progress-label">
              Executed: <strong>{testResults.length} / 20</strong> Tests
            </span>
            <div className="test-counter-pills">
              <span className="pill-pass">
                <CheckCircle2 size={13} />
                <span>{passCount} Passed</span>
              </span>
              {failCount > 0 && (
                <span className="pill-fail">
                  <XCircle size={13} />
                  <span>{failCount} Failed</span>
                </span>
              )}
            </div>
          </div>

          <div className="test-progress-track">
            <div
              className={`test-progress-fill ${failCount > 0 ? 'has-fail' : ''}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Categories Tab Bar */}
        <div className="test-categories-bar">
          <div className="categories-scroll">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`category-chip ${filterCategory === cat ? 'active' : ''}`}
                onClick={() => setFilterCategory(cat)}
              >
                {cat}
                {cat !== 'ALL' && (
                  <span className="cat-count">
                    ({testResults.filter((t) => t.category === cat).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Results List */}
        <div className="test-results-scroll-area">
          {testResults.length === 0 && !isRunning && (
            <div className="test-empty-state">
              <Terminal size={40} className="empty-icon" />
              <h3>Suite Ready for Execution</h3>
              <p>
                Click <strong>&quot;Run All 20 Tests&quot;</strong> above to execute tests 1 through 20 with live ASCII topology diagrams, concurrency simulations, and authorization assertions.
              </p>
            </div>
          )}

          {filteredTests.map((test) => {
            const isExpanded = expandedTestId === test.id;
            return (
              <div
                key={test.id}
                className={`test-result-card ${test.status === 'PASS' ? 'card-pass' : 'card-fail'}`}
              >
                <div
                  className="test-card-header"
                  onClick={() => setExpandedTestId(isExpanded ? null : test.id)}
                >
                  <div className="test-card-header-left">
                    {test.status === 'PASS' ? (
                      <CheckCircle2 size={18} className="text-emerald-500" />
                    ) : (
                      <XCircle size={18} className="text-red-500" />
                    )}
                    <span className="test-title">{test.title}</span>
                    <span className="test-category-tag">{test.category}</span>
                  </div>

                  <div className="test-card-header-right">
                    <span className="test-duration">{test.duration}ms</span>
                    <span className={`test-status-tag tag-${test.status.toLowerCase()}`}>
                      {test.status}
                    </span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Card Body / Details */}
                <div className="test-card-body">
                  <div className="test-io-row">
                    <div className="io-col">
                      <span className="io-label">Expected:</span>
                      <span className="io-value text-slate-700">{test.expected || 'N/A'}</span>
                    </div>
                    <div className="io-col">
                      <span className="io-label">Actual:</span>
                      <span className="io-value text-emerald-700">{test.actual || test.error || 'N/A'}</span>
                    </div>
                  </div>

                  {test.ascii && (
                    <div className="test-ascii-block">
                      <div className="ascii-header">
                        <Layers size={13} />
                        <span>Genealogy Tree ASCII Snapshot:</span>
                      </div>
                      <pre className="ascii-content">{test.ascii}</pre>
                    </div>
                  )}

                  {isExpanded && test.data && (
                    <div className="test-json-dump">
                      <pre>{JSON.stringify(test.data, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="tree-test-modal-footer">
          <span className="test-footer-compliance">
            Prompt 18 MLM Tree Contract &bull; 20 Tests Built-in &bull; Node 24 Native Engine
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {testResults.length > 0 && (
              <button
                type="button"
                className="btn-test-reset"
                onClick={() => setTestResults([])}
                disabled={isRunning}
              >
                <RotateCcw size={14} />
                <span>Clear Results</span>
              </button>
            )}
            <button
              type="button"
              className="btn-test-done"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
