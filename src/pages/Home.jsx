import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Check,
  X,
  ChevronUp,
  ShoppingBag,
  Users,
  Megaphone,
  GitFork,
  Crown,
  Gem,
  Award,
  CheckCircle2,
} from 'lucide-react';

import './Home.css';

import togetherWeRiseImg from '../assets/home/together_we_rise.png';

/**
 * Premium, Animation-rich Home Page for KASHVIMLM
 * Inspired by the reference layout, structure, and animation styles:
 * - Dynamic Wave & Particle Hero Carousel (Electronics & Clothes slides)
 * - 3D Pedestal Product Showcase with Floating Glowing Badges
 * - Smooth Marquee "LATEST NEWS" Ticker
 * - Brand Story / Quality Commitment with Leadership Visuals
 * - Interactive Animated Binary Tree Architecture
 * - Floating Back-To-Top Button
 * - Interactive Modals (Product Preview & Join Network)
 * - Colors: Midnight Navy, Ocean Blue, Electric Cyan, Soft Pink & Radiant Gold
 */
function Home() {

  // Floating Back-to-Top State
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Modals & Interaction States
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [addedItem, setAddedItem] = useState(null);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [joinForm, setJoinForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    sponsorId: '',
    state: 'Maharashtra',
  });

  // Binary Tree 5 Stages Data: Ruby (Apex) -> Diamond -> Platinum -> Gold -> Silver (Base)
  const binaryNodes = {
    // Stage 1: Ruby (Apex Leader)
    ruby: {
      name: 'ID: 1001',
      rank: 'Ruby',
    },
    // Stage 2: Diamond (Dual Frontline Leaders)
    diamond1: {
      name: 'ID: 1002',
      rank: 'Diamond',
    },
    diamond2: {
      name: 'ID: 1003',
      rank: 'Diamond',
    },
    // Stage 3: Platinum (Senior Directors)
    plat1: {
      name: 'ID: 1004',
      rank: 'Platinum',
    },
    plat2: {
      name: 'ID: 1005',
      rank: 'Platinum',
    },
    plat3: {
      name: 'ID: 1006',
      rank: 'Platinum',
    },
    plat4: {
      name: 'ID: 1007',
      rank: 'Platinum',
    },
    // Stage 4: Gold (Team Managers)
    gold1: {
      name: 'ID: 1008',
      rank: 'Gold',
    },
    gold2: {
      name: 'ID: 1009',
      rank: 'Gold',
    },
    gold3: {
      name: 'ID: 1010',
      rank: 'Gold',
    },
    gold4: {
      name: 'ID: 1011',
      rank: 'Gold',
    },
    // Stage 5: Silver (Foundation Associates)
    silver1: {
      name: 'ID: 1012',
      rank: 'Silver',
    },
    silver2: {
      name: 'ID: 1013',
      rank: 'Silver',
    },
    silver3: {
      name: 'ID: 1014',
      rank: 'Silver',
    },
    silver4: {
      name: 'ID: 1015',
      rank: 'Silver',
    },
    silver5: {
      name: 'ID: 1016',
      rank: 'Silver',
    },
    silver6: {
      name: 'ID: 1017',
      rank: 'Silver',
    },
    silver7: {
      name: 'ID: 1018',
      rank: 'Silver',
    },
    silver8: {
      name: 'ID: 1019',
      rank: 'Silver',
    },
  };
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 320) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };



  // Handle Add to Cart
  const handleAddToCart = (productName) => {
    setAddedItem(productName);
    setTimeout(() => {
      setAddedItem(null);
    }, 2000);
  };

  // Handle Join Form
  const handleJoinSubmit = (e) => {
    e.preventDefault();
    setJoinSuccess(true);
    setTimeout(() => {
      setJoinSuccess(false);
      setIsJoinModalOpen(false);
      setJoinForm({
        fullName: '',
        email: '',
        phone: '',
        sponsorId: '',
        state: 'Maharashtra',
      });
    }, 1800);
  };

  return (
    <div className="vadic-home-wrapper">
      {/* =========================================================================
          1. HERO SECTION
          ========================================================================= */}
      <section
        className="vadic-hero-section ref-style-hero"
        aria-label="Kashvi MLM Showcase"
      >
        {/* Static Glowing Particle Waves Background */}
        <div className="hero-wave-canvas-wrap" aria-hidden="true">
          <svg
            className="hero-wave-svg"
            viewBox="0 0 1440 600"
            fill="none"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="waveGoldCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                <stop offset="35%" stopColor="#f59e0b" stopOpacity="0.65" />
                <stop offset="70%" stopColor="#ec4899" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="ribbonGlow" x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stopColor="#00e5ff" stopOpacity="0" />
                <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
              </linearGradient>
              <filter id="glowBlur" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <path
              d="M-50,180 C320,40 550,380 960,140 C1220,-10 1380,240 1520,160"
              stroke="url(#waveGoldCyan)"
              strokeWidth="3"
              filter="url(#glowBlur)"
              className="wave-line-1"
            />
            <path
              d="M-100,280 C240,110 680,450 1100,210 C1320,70 1420,310 1550,220"
              stroke="url(#waveGoldCyan)"
              strokeWidth="1.8"
              strokeDasharray="4 6"
              filter="url(#glowBlur)"
              className="wave-line-2"
            />
            <path
              d="M-40,80 C360,260 720,-40 1080,290 C1300,480 1460,90 1550,130"
              stroke="url(#ribbonGlow)"
              strokeWidth="2.5"
              filter="url(#glowBlur)"
              className="wave-line-3"
            />
            <path
              d="M-20,420 C420,190 760,520 1200,320 C1380,220 1480,390 1550,350"
              stroke="url(#waveGoldCyan)"
              strokeWidth="1.2"
              opacity="0.5"
              className="wave-line-4"
            />
          </svg>
          <div className="hero-particle-stars" />
        </div>

        {/* Ambient Stage Lighting Glow */}
        <div className="hero-stage-glow-ambient" aria-hidden="true" />

        <div className="hero-ref-container hero-split-layout">
          {/* Main Hero Column: Focused Headline, Narrative, Checklist & CTAs */}
          <div className="hero-ref-left-col">
            <div className="hero-interactive-hint">
              <Sparkles size={15} className="hint-sparkle-icon" />
              <span>India&apos;s Leading Direct Selling &amp; E-Commerce Platform</span>
            </div>

            {/* Main Headline with Highlight Colors */}
            <h1 className="hero-ref-title">
              Empower Your Future With{' '}
              <span className="hero-gradient-text-cyan">Smart Tech</span> &amp;{' '}
              <span className="hero-gradient-text-gold">Luxury Hozri.</span>
            </h1>

            {/* Descriptive Narrative */}
            <p className="hero-ref-desc">
              Experience India&apos;s most rewarding direct selling network. Combine high-velocity certified consumer electronics with pure combed cotton hozri apparel—backed by transparent 1:1 binary matching and instant BV tracking.
            </p>

            {/* Feature Checklist (3 Bullet Points with Check Circles) */}
            <div className="hero-checklist-container">
              <div className="hero-check-item">
                <div className="check-bullet-icon">
                  <Check size={14} strokeWidth={3} />
                </div>
                <span>Direct factory pricing on 5G smartphones &amp; premium textiles</span>
              </div>
              <div className="hero-check-item">
                <div className="check-bullet-icon">
                  <Check size={14} strokeWidth={3} />
                </div>
                <span>Automated 1:1 binary balancing with daily instant bank transfers</span>
              </div>
              <div className="hero-check-item">
                <div className="check-bullet-icon">
                  <Check size={14} strokeWidth={3} />
                </div>
                <span>Pan-India regional hub fulfillment with zero distributor risk</span>
              </div>
            </div>

            {/* Hero CTA Action Buttons */}
            <div className="hero-cta-actions">
              <button
                type="button"
                className="btn-vadic-orange-cta"
                onClick={() => setIsJoinModalOpen(true)}
              >
                <span>JOIN NETWORK</span>
                <ArrowRight size={17} />
              </button>
              <Link to="/contact" className="btn-vadic-ghost-cta">
                <span>CONNECT WITH US</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Dynamic Falling Convergence Balls & Kashvimlm Reveal Stage */}
          <div className="hero-brand-stage-col" aria-label="Kashvimlm Convergence Animation">
            <div className="brand-anim-wrapper">
              {/* Background Ambient Glow */}
              <div className="anim-glow-backdrop" />

              {/* Falling Balls (Scattered points -> crashing to center) */}
              <div className="anim-balls-cluster">
                <div className="anim-ball ball-pos-1">
                  <div className="ball-inner-sphere ball-color-cyan" />
                  <div className="ball-trail-flare flare-cyan" />
                </div>
                <div className="anim-ball ball-pos-2">
                  <div className="ball-inner-sphere ball-color-gold" />
                  <div className="ball-trail-flare flare-gold" />
                </div>
                <div className="anim-ball ball-pos-3">
                  <div className="ball-inner-sphere ball-color-pink" />
                  <div className="ball-trail-flare flare-pink" />
                </div>
                <div className="anim-ball ball-pos-4">
                  <div className="ball-inner-sphere ball-color-emerald" />
                  <div className="ball-trail-flare flare-emerald" />
                </div>
                <div className="anim-ball ball-pos-5">
                  <div className="ball-inner-sphere ball-color-sky" />
                  <div className="ball-trail-flare flare-sky" />
                </div>
                <div className="anim-ball ball-pos-6">
                  <div className="ball-inner-sphere ball-color-orange" />
                  <div className="ball-trail-flare flare-orange" />
                </div>
                <div className="anim-ball ball-pos-7">
                  <div className="ball-inner-sphere ball-color-purple" />
                  <div className="ball-trail-flare flare-purple" />
                </div>
                <div className="anim-ball ball-pos-8">
                  <div className="ball-inner-sphere ball-color-yellow" />
                  <div className="ball-trail-flare flare-yellow" />
                </div>
                <div className="anim-ball ball-pos-9">
                  <div className="ball-inner-sphere ball-color-apex-gold" />
                  <div className="ball-trail-flare flare-gold" />
                </div>
              </div>

              {/* Collision Impact Flash & Spark Rays */}
              <div className="anim-impact-burst">
                <div className="impact-flash" />
                <div className="impact-spark-rays">
                  <span className="spark-ray ray-1" />
                  <span className="spark-ray ray-2" />
                  <span className="spark-ray ray-3" />
                  <span className="spark-ray ray-4" />
                  <span className="spark-ray ray-5" />
                  <span className="spark-ray ray-6" />
                  <span className="spark-ray ray-7" />
                  <span className="spark-ray ray-8" />
                </div>
              </div>

              {/* Emergence of "Kashvimlm" Name */}
              <div className="anim-brand-reveal">
                <div className="brand-badge-crest">
                  <Crown size={26} className="crest-crown-icon" />
                  <Sparkles size={18} className="crest-sparkle-icon" />
                </div>

                <div className="brand-logo-text-wrap">
                  <span className="brand-logo-glow-underlay">KASHVIMLM</span>
                  <h2 className="brand-logo-main">
                    <span className="logo-part-kashvi">Kashvi</span>
                    <span className="logo-part-mlm">mlm</span>
                  </h2>
                  <div className="brand-shine-sweep" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. LATEST NEWS TICKER SECTION (Exact Replica of Reference Marquee Bar)
          ========================================================================= */}
      <section className="vadic-news-ticker-section" aria-label="Latest News and Updates">
        <div className="ticker-badge-box">
          <div className="ticker-icon-circle">
            <Megaphone size={18} />
          </div>
          <span className="ticker-badge-text">LATEST NEWS</span>
        </div>

        <div className="ticker-marquee-track">
          <div className="ticker-marquee-content">
            <span className="ticker-item">
              ⚡ <strong>New Launch:</strong> Kashvi 5G Flagship Smartphones &amp; Ultra-Slim Laptops are now live with 2X BV points!
            </span>
            <span className="ticker-bullet">&bull;</span>
            <span className="ticker-item">
              👕 <strong>Autumn Drop:</strong> Pure Combed Cotton Tees and Winter Fleece Hoodies now available in all regional hubs.
            </span>
            <span className="ticker-bullet">&bull;</span>
            <span className="ticker-item">
              🏆 <strong>Leadership Milestone:</strong> Congratulations to 120+ newly certified Gold &amp; Diamond network leaders this month!
            </span>
            <span className="ticker-bullet">&bull;</span>
            <span className="ticker-item">
              📦 <strong>Pan-India Express:</strong> Free insured door delivery active on all distributor orders over ₹999 across 15+ states!
            </span>
            <span className="ticker-bullet">&bull;</span>
            <span className="ticker-item">
              💎 <strong>Payout Transparency:</strong> Weekly direct selling wholesale margins and team performance rewards credited seamlessly.
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. INTRODUCTION SECTION
          ========================================================================= */}
      <section className="vadic-story-section" aria-label="Introduction">
        <div className="vadic-story-grid">
          {/* Left Column: Introduction Copy & CTA Button */}
          <div className="story-copy-column">
            <div className="story-badge-pill">
              <Sparkles size={14} />
              <span>ABOUT KASHVI MLM</span>
            </div>

            <h2 className="story-heading">
              Empowering Financial Growth &amp; Entrepreneurship
            </h2>

            <p className="story-paragraph">
              Kashvi MLM is India&apos;s next-generation direct selling and e-commerce platform dedicated to empowering aspiring entrepreneurs, distributors, and households with sustainable financial independence. We bridge the gap between premier manufacturing and everyday consumers by delivering certified high-performance 5G electronics, smart lifestyle appliances, and premium combed cotton apparel at honest factory-direct pricing.
            </p>

            <p className="story-paragraph">
              Built on a foundation of transparency, integrity, and community success, our rewarding 1:1 binary compensation structure pairs instant Business Volume (BV) tracking with automated daily payouts and clear leadership advancement from Silver to Ruby tiers. Backed by extensive regional hub fulfillment and dedicated mentorship, Kashvi MLM equips every partner with the tools needed to build long-term generational wealth.
            </p>

            <div className="story-actions">
              <Link to="/contact" className="btn-vadic-orange-cta">
                <span>CONNECT WITH US</span>
                <ArrowRight size={17} />
              </Link>

              <div className="story-assurance-item">
                <ShieldCheck size={20} className="text-cyan-accent" />
                <span>100% Genuine Certified Quality</span>
              </div>
            </div>
          </div>

          {/* Right Column: Leadership / Growth Visual Showcase */}
          <div className="story-visual-column">
            <div className="story-image-frame">
              <img
                src={togetherWeRiseImg}
                alt="Kashvi Leaders Mountaineering Together - Together We Rise"
                className="story-frame-img"
              />
              <div className="story-gold-bottom-bar" />

              {/* Floating Stat Pill on the Visual */}
              <div className="story-floating-stat-pill">
                <Users size={16} className="text-gold-accent" />
                <span>25,000+ Satisfied Households</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. INTERACTIVE ANIMATED BINARY TREE SECTION (5 Stages: Ruby to Silver)
          ========================================================================= */}
      <section className="vadic-binary-tree-section" aria-label="Binary Network Architecture">
        <div className="binary-tree-container">
          {/* Section Header */}
          <div className="binary-section-header">
            <div className="story-badge-pill">
              <GitFork size={14} />
              <span>5-STAGE LEADERSHIP LINEAGE</span>
            </div>

            <h2 className="binary-section-title">
              Power of Exponential <span className="contact-hero-title-accent">Binary Growth</span>
            </h2>

            <p className="binary-section-desc">
              Compounding across 5 elite tiers: From foundational <strong>Silver Associates</strong>, ascending through <strong>Gold Managers</strong>, <strong>Platinum Executives</strong>, and <strong>Diamond Directors</strong>, to the apex <strong>Ruby Crown Leader</strong>.
            </p>

            {/* 5-Level Visual Rank Legend */}
            <div className="binary-rank-legend-bar">
              <div className="rank-legend-chip chip-ruby">
                <Crown size={13} />
                <span>Ruby (Apex)</span>
              </div>
              <div className="rank-legend-chip chip-diamond">
                <Gem size={13} />
                <span>Diamond</span>
              </div>
              <div className="rank-legend-chip chip-platinum">
                <Award size={13} />
                <span>Platinum</span>
              </div>
              <div className="rank-legend-chip chip-gold">
                <Users size={13} />
                <span>Gold</span>
              </div>
              <div className="rank-legend-chip chip-silver">
                <CheckCircle2 size={13} />
                <span>Silver (Base)</span>
              </div>
            </div>
          </div>

          {/* Interactive Binary Canvas Board - NON-SCROLLABLE */}
          <div className="binary-board-wrapper">
            <div className="binary-tree-board">
              {/* SVG Connecting Vector Lines & Animated Pulse Rays */}
              <svg
                className="binary-svg-lines"
                viewBox="0 0 1000 500"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  {/* Gradients */}
                  <linearGradient id="grad-ruby-diamond" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.9" />
                  </linearGradient>
                  <linearGradient id="grad-diamond-plat" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0.9" />
                  </linearGradient>
                  <linearGradient id="grad-plat-gold" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.9" />
                  </linearGradient>
                  <linearGradient id="grad-gold-silver" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.9" />
                  </linearGradient>
                  <filter id="svg-glow-ruby" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="svg-glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="svg-glow-plat" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="svg-glow-gold" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="svg-glow-silver" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* 1. RUBY APEX -> 2 DIAMONDS */}
                <path d="M 500 56 C 500 90, 260 84, 260 118" className="tree-track-line" />
                <path d="M 500 56 C 500 90, 260 84, 260 118" stroke="url(#grad-ruby-diamond)" className="tree-flow-line flowing" />
                <circle r="3.5" fill="#f43f5e" filter="url(#svg-glow-ruby)">
                  <animateMotion path="M 500 56 C 500 90, 260 84, 260 118" dur="2s" repeatCount="indefinite" />
                </circle>

                <path d="M 500 56 C 500 90, 740 84, 740 118" className="tree-track-line" />
                <path d="M 500 56 C 500 90, 740 84, 740 118" stroke="url(#grad-ruby-diamond)" className="tree-flow-line flowing" />
                <circle r="3.5" fill="#f43f5e" filter="url(#svg-glow-ruby)">
                  <animateMotion path="M 500 56 C 500 90, 740 84, 740 118" dur="2s" begin="0.4s" repeatCount="indefinite" />
                </circle>

                {/* 2. DIAMONDS -> 4 PLATINUMS */}
                {/* Left Diamond to Plat 1 & Plat 2 */}
                <path d="M 260 158 C 260 190, 140 186, 140 218" className="tree-track-line" />
                <path d="M 260 158 C 260 190, 140 186, 140 218" stroke="url(#grad-diamond-plat)" className="tree-flow-line flowing" />
                <circle r="3" fill="#00e5ff" filter="url(#svg-glow-cyan)">
                  <animateMotion path="M 260 158 C 260 190, 140 186, 140 218" dur="2.2s" begin="0.2s" repeatCount="indefinite" />
                </circle>

                <path d="M 260 158 C 260 190, 380 186, 380 218" className="tree-track-line" />
                <path d="M 260 158 C 260 190, 380 186, 380 218" stroke="url(#grad-diamond-plat)" className="tree-flow-line flowing" />
                <circle r="3" fill="#00e5ff" filter="url(#svg-glow-cyan)">
                  <animateMotion path="M 260 158 C 260 190, 380 186, 380 218" dur="2.2s" begin="0.5s" repeatCount="indefinite" />
                </circle>

                {/* Right Diamond to Plat 3 & Plat 4 */}
                <path d="M 740 158 C 740 190, 620 186, 620 218" className="tree-track-line" />
                <path d="M 740 158 C 740 190, 620 186, 620 218" stroke="url(#grad-diamond-plat)" className="tree-flow-line flowing" />
                <circle r="3" fill="#00e5ff" filter="url(#svg-glow-cyan)">
                  <animateMotion path="M 740 158 C 740 190, 620 186, 620 218" dur="2.2s" begin="0.3s" repeatCount="indefinite" />
                </circle>

                <path d="M 740 158 C 740 190, 860 186, 860 218" className="tree-track-line" />
                <path d="M 740 158 C 740 190, 860 186, 860 218" stroke="url(#grad-diamond-plat)" className="tree-flow-line flowing" />
                <circle r="3" fill="#00e5ff" filter="url(#svg-glow-cyan)">
                  <animateMotion path="M 740 158 C 740 190, 860 186, 860 218" dur="2.2s" begin="0.6s" repeatCount="indefinite" />
                </circle>

                {/* 3. PLATINUMS -> 4 GOLDS */}
                <path d="M 140 256 L 140 318" className="tree-track-line" />
                <path d="M 140 256 L 140 318" stroke="url(#grad-plat-gold)" className="tree-flow-line flowing" />
                <circle r="3" fill="#e2e8f0" filter="url(#svg-glow-plat)">
                  <animateMotion path="M 140 256 L 140 318" dur="1.8s" begin="0.1s" repeatCount="indefinite" />
                </circle>

                <path d="M 380 256 L 380 318" className="tree-track-line" />
                <path d="M 380 256 L 380 318" stroke="url(#grad-plat-gold)" className="tree-flow-line flowing" />
                <circle r="3" fill="#e2e8f0" filter="url(#svg-glow-plat)">
                  <animateMotion path="M 380 256 L 380 318" dur="1.8s" begin="0.4s" repeatCount="indefinite" />
                </circle>

                <path d="M 620 256 L 620 318" className="tree-track-line" />
                <path d="M 620 256 L 620 318" stroke="url(#grad-plat-gold)" className="tree-flow-line flowing" />
                <circle r="3" fill="#e2e8f0" filter="url(#svg-glow-plat)">
                  <animateMotion path="M 620 256 L 620 318" dur="1.8s" begin="0.2s" repeatCount="indefinite" />
                </circle>

                <path d="M 860 256 L 860 318" className="tree-track-line" />
                <path d="M 860 256 L 860 318" stroke="url(#grad-plat-gold)" className="tree-flow-line flowing" />
                <circle r="3" fill="#e2e8f0" filter="url(#svg-glow-plat)">
                  <animateMotion path="M 860 256 L 860 318" dur="1.8s" begin="0.5s" repeatCount="indefinite" />
                </circle>

                {/* 4. GOLDS -> 8 SILVERS */}
                {/* Gold 1 to Silver 1 & Silver 2 */}
                <path d="M 140 354 C 140 390, 80 384, 80 420" className="tree-track-line" />
                <path d="M 140 354 C 140 390, 80 384, 80 420" stroke="url(#grad-gold-silver)" className="tree-flow-line flowing" />
                <circle r="2.8" fill="#fbbf24" filter="url(#svg-glow-gold)">
                  <animateMotion path="M 140 354 C 140 390, 80 384, 80 420" dur="2.2s" begin="0.2s" repeatCount="indefinite" />
                </circle>

                <path d="M 140 354 C 140 390, 200 384, 200 420" className="tree-track-line" />
                <path d="M 140 354 C 140 390, 200 384, 200 420" stroke="url(#grad-gold-silver)" className="tree-flow-line flowing" />
                <circle r="2.8" fill="#fbbf24" filter="url(#svg-glow-gold)">
                  <animateMotion path="M 140 354 C 140 390, 200 384, 200 420" dur="2.2s" begin="0.5s" repeatCount="indefinite" />
                </circle>

                {/* Gold 2 to Silver 3 & Silver 4 */}
                <path d="M 380 354 C 380 390, 320 384, 320 420" className="tree-track-line" />
                <path d="M 380 354 C 380 390, 320 384, 320 420" stroke="url(#grad-gold-silver)" className="tree-flow-line flowing" />
                <circle r="2.8" fill="#fbbf24" filter="url(#svg-glow-gold)">
                  <animateMotion path="M 380 354 C 380 390, 320 384, 320 420" dur="2.2s" begin="0.3s" repeatCount="indefinite" />
                </circle>

                <path d="M 380 354 C 380 390, 440 384, 440 420" className="tree-track-line" />
                <path d="M 380 354 C 380 390, 440 384, 440 420" stroke="url(#grad-gold-silver)" className="tree-flow-line flowing" />
                <circle r="2.8" fill="#fbbf24" filter="url(#svg-glow-gold)">
                  <animateMotion path="M 380 354 C 380 390, 440 384, 440 420" dur="2.2s" begin="0.6s" repeatCount="indefinite" />
                </circle>

                {/* Gold 3 to Silver 5 & Silver 6 */}
                <path d="M 620 354 C 620 390, 560 384, 560 420" className="tree-track-line" />
                <path d="M 620 354 C 620 390, 560 384, 560 420" stroke="url(#grad-gold-silver)" className="tree-flow-line flowing" />
                <circle r="2.8" fill="#fbbf24" filter="url(#svg-glow-gold)">
                  <animateMotion path="M 620 354 C 620 390, 560 384, 560 420" dur="2.2s" begin="0.2s" repeatCount="indefinite" />
                </circle>

                <path d="M 620 354 C 620 390, 680 384, 680 420" className="tree-track-line" />
                <path d="M 620 354 C 620 390, 680 384, 680 420" stroke="url(#grad-gold-silver)" className="tree-flow-line flowing" />
                <circle r="2.8" fill="#fbbf24" filter="url(#svg-glow-gold)">
                  <animateMotion path="M 620 354 C 620 390, 680 384, 680 420" dur="2.2s" begin="0.5s" repeatCount="indefinite" />
                </circle>

                {/* Gold 4 to Silver 7 & Silver 8 */}
                <path d="M 860 354 C 860 390, 800 384, 800 420" className="tree-track-line" />
                <path d="M 860 354 C 860 390, 800 384, 800 420" stroke="url(#grad-gold-silver)" className="tree-flow-line flowing" />
                <circle r="2.8" fill="#fbbf24" filter="url(#svg-glow-gold)">
                  <animateMotion path="M 860 354 C 860 390, 800 384, 800 420" dur="2.2s" begin="0.3s" repeatCount="indefinite" />
                </circle>

                <path d="M 860 354 C 860 390, 920 384, 920 420" className="tree-track-line" />
                <path d="M 860 354 C 860 390, 920 384, 920 420" stroke="url(#grad-gold-silver)" className="tree-flow-line flowing" />
                <circle r="2.8" fill="#fbbf24" filter="url(#svg-glow-gold)">
                  <animateMotion path="M 860 354 C 860 390, 920 384, 920 420" dur="2.2s" begin="0.7s" repeatCount="indefinite" />
                </circle>
              </svg>

              {/* HTML NODES OVERLAY (5 Symmetrical Stages, 19 Cards) */}

              {/* STAGE 1: RUBY (Apex Root) */}
              <div className="vadic-tree-card node-ruby tier-ruby">
                <div className="vadic-tree-avatar avatar-ruby">
                  <Crown size={16} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.ruby.name}</span>
                    <span className="vadic-tree-status-dot dot-active" title="Active Member" />
                  </div>
                  <span className="vadic-tree-rank rank-ruby">{binaryNodes.ruby.rank}</span>
                </div>
              </div>

              {/* STAGE 2: DIAMOND (Dual Frontline Leaders) */}
              <div className="vadic-tree-card node-diamond-1 tier-diamond">
                <div className="vadic-tree-avatar avatar-diamond">
                  <Gem size={15} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.diamond1.name}</span>
                    <span className="vadic-tree-status-dot dot-active" />
                  </div>
                  <span className="vadic-tree-rank rank-diamond">{binaryNodes.diamond1.rank}</span>
                </div>
              </div>

              <div className="vadic-tree-card node-diamond-2 tier-diamond">
                <div className="vadic-tree-avatar avatar-diamond">
                  <Gem size={15} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.diamond2.name}</span>
                    <span className="vadic-tree-status-dot dot-active" />
                  </div>
                  <span className="vadic-tree-rank rank-diamond">{binaryNodes.diamond2.rank}</span>
                </div>
              </div>

              {/* STAGE 3: PLATINUM (Senior Directors) */}
              <div className="vadic-tree-card node-plat-1 tier-platinum">
                <div className="vadic-tree-avatar avatar-platinum">
                  <Award size={14} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.plat1.name}</span>
                    <span className="vadic-tree-status-dot dot-active" />
                  </div>
                  <span className="vadic-tree-rank rank-platinum">{binaryNodes.plat1.rank}</span>
                </div>
              </div>

              <div className="vadic-tree-card node-plat-2 tier-platinum">
                <div className="vadic-tree-avatar avatar-platinum">
                  <Award size={14} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.plat2.name}</span>
                    <span className="vadic-tree-status-dot dot-active" />
                  </div>
                  <span className="vadic-tree-rank rank-platinum">{binaryNodes.plat2.rank}</span>
                </div>
              </div>

              <div className="vadic-tree-card node-plat-3 tier-platinum">
                <div className="vadic-tree-avatar avatar-platinum">
                  <Award size={14} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.plat3.name}</span>
                    <span className="vadic-tree-status-dot dot-active" />
                  </div>
                  <span className="vadic-tree-rank rank-platinum">{binaryNodes.plat3.rank}</span>
                </div>
              </div>

              <div className="vadic-tree-card node-plat-4 tier-platinum">
                <div className="vadic-tree-avatar avatar-platinum">
                  <Award size={14} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.plat4.name}</span>
                    <span className="vadic-tree-status-dot dot-active" />
                  </div>
                  <span className="vadic-tree-rank rank-platinum">{binaryNodes.plat4.rank}</span>
                </div>
              </div>

              {/* STAGE 4: GOLD (Team Managers) */}
              <div className="vadic-tree-card node-gold-1 tier-gold">
                <div className="vadic-tree-avatar avatar-gold">
                  <Users size={13} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.gold1.name}</span>
                    <span className="vadic-tree-status-dot dot-active" />
                  </div>
                  <span className="vadic-tree-rank rank-gold">{binaryNodes.gold1.rank}</span>
                </div>
              </div>

              <div className="vadic-tree-card node-gold-2 tier-gold">
                <div className="vadic-tree-avatar avatar-gold">
                  <Users size={13} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.gold2.name}</span>
                    <span className="vadic-tree-status-dot dot-active" />
                  </div>
                  <span className="vadic-tree-rank rank-gold">{binaryNodes.gold2.rank}</span>
                </div>
              </div>

              <div className="vadic-tree-card node-gold-3 tier-gold">
                <div className="vadic-tree-avatar avatar-gold">
                  <Users size={13} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.gold3.name}</span>
                    <span className="vadic-tree-status-dot dot-active" />
                  </div>
                  <span className="vadic-tree-rank rank-gold">{binaryNodes.gold3.rank}</span>
                </div>
              </div>

              <div className="vadic-tree-card node-gold-4 tier-gold">
                <div className="vadic-tree-avatar avatar-gold">
                  <Users size={13} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.gold4.name}</span>
                    <span className="vadic-tree-status-dot dot-active" />
                  </div>
                  <span className="vadic-tree-rank rank-gold">{binaryNodes.gold4.rank}</span>
                </div>
              </div>

              {/* STAGE 5: SILVER (Foundation Associates) */}
              <div className="vadic-tree-card node-silver-1 tier-silver">
                <div className="vadic-tree-avatar avatar-silver">
                  <CheckCircle2 size={12} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.silver1.name}</span>
                    <span className="vadic-tree-status-dot dot-active" />
                  </div>
                  <span className="vadic-tree-rank rank-silver">{binaryNodes.silver1.rank}</span>
                </div>
              </div>

              <div className="vadic-tree-card node-silver-2 tier-silver">
                <div className="vadic-tree-avatar avatar-silver">
                  <CheckCircle2 size={12} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.silver2.name}</span>
                    <span className="vadic-tree-status-dot dot-active" />
                  </div>
                  <span className="vadic-tree-rank rank-silver">{binaryNodes.silver2.rank}</span>
                </div>
              </div>

              <div className="vadic-tree-card node-silver-3 tier-silver">
                <div className="vadic-tree-avatar avatar-silver">
                  <CheckCircle2 size={12} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.silver3.name}</span>
                    <span className="vadic-tree-status-dot dot-active" />
                  </div>
                  <span className="vadic-tree-rank rank-silver">{binaryNodes.silver3.rank}</span>
                </div>
              </div>

              <div className="vadic-tree-card node-silver-4 tier-silver">
                <div className="vadic-tree-avatar avatar-silver">
                  <CheckCircle2 size={12} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.silver4.name}</span>
                    <span className="vadic-tree-status-dot dot-active" />
                  </div>
                  <span className="vadic-tree-rank rank-silver">{binaryNodes.silver4.rank}</span>
                </div>
              </div>

              <div className="vadic-tree-card node-silver-5 tier-silver">
                <div className="vadic-tree-avatar avatar-silver">
                  <CheckCircle2 size={12} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.silver5.name}</span>
                    <span className="vadic-tree-status-dot dot-active" />
                  </div>
                  <span className="vadic-tree-rank rank-silver">{binaryNodes.silver5.rank}</span>
                </div>
              </div>

              <div className="vadic-tree-card node-silver-6 tier-silver">
                <div className="vadic-tree-avatar avatar-silver">
                  <CheckCircle2 size={12} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.silver6.name}</span>
                    <span className="vadic-tree-status-dot dot-active" />
                  </div>
                  <span className="vadic-tree-rank rank-silver">{binaryNodes.silver6.rank}</span>
                </div>
              </div>

              <div className="vadic-tree-card node-silver-7 tier-silver">
                <div className="vadic-tree-avatar avatar-silver">
                  <CheckCircle2 size={12} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.silver7.name}</span>
                    <span className="vadic-tree-status-dot dot-active" />
                  </div>
                  <span className="vadic-tree-rank rank-silver">{binaryNodes.silver7.rank}</span>
                </div>
              </div>

              <div className="vadic-tree-card node-silver-8 tier-silver">
                <div className="vadic-tree-avatar avatar-silver">
                  <CheckCircle2 size={12} />
                </div>
                <div className="vadic-tree-meta">
                  <div className="vadic-tree-title-row">
                    <span className="vadic-tree-name">{binaryNodes.silver8.name}</span>
                    <span className="vadic-tree-status-dot dot-active" />
                  </div>
                  <span className="vadic-tree-rank rank-silver">{binaryNodes.silver8.rank}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* =========================================================================
          6. FLOATING BACK TO TOP BUTTON (From Reference Image Right Edge)
          ========================================================================= */}
      {showBackToTop && (
        <button
          type="button"
          className="vadic-back-to-top-btn"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          title="Scroll to top"
        >
          <ChevronUp size={22} />
        </button>
      )}

      {/* =========================================================================
          7. MODALS: Join Network & Product Quick View
          ========================================================================= */}

      {/* Join Network Modal */}
      {isJoinModalOpen && (
        <div className="vadic-modal-overlay" onClick={() => setIsJoinModalOpen(false)}>
          <div
            className="vadic-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="join-dialog-title"
          >
            <button
              type="button"
              className="vadic-modal-close"
              onClick={() => setIsJoinModalOpen(false)}
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>

            {joinSuccess ? (
              <div className="modal-success-state">
                <div className="success-icon-badge">
                  <Check size={36} />
                </div>
                <h3>Welcome to KASHVI MLM!</h3>
                <p>
                  Your distributor application has been registered successfully. Our regional manager
                  will connect with you to activate your BV portal.
                </p>
              </div>
            ) : (
              <>
                <div className="modal-header-tag">
                  <Sparkles size={20} className="text-cyan-accent" />
                  <span>KASHVI DISTRIBUTOR NETWORK</span>
                </div>
                <h3 id="join-dialog-title" className="modal-title">
                  Start Your Journey to Prosperity
                </h3>
                <p className="modal-subtitle">
                  Distribute high-demand 5G personal electronics and comfortable everyday Hozri garments
                  with wholesale margins and leadership bonuses.
                </p>

                <form className="modal-join-form" onSubmit={handleJoinSubmit}>
                  <div className="form-field">
                    <label htmlFor="modal-name">Full Name *</label>
                    <input
                      id="modal-name"
                      type="text"
                      required
                      placeholder="e.g. Ramesh Patel"
                      value={joinForm.fullName}
                      onChange={(e) =>
                        setJoinForm((prev) => ({ ...prev, fullName: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-field-row">
                    <div className="form-field">
                      <label htmlFor="modal-email">Email Address *</label>
                      <input
                        id="modal-email"
                        type="email"
                        required
                        placeholder="you@domain.com"
                        value={joinForm.email}
                        onChange={(e) =>
                          setJoinForm((prev) => ({ ...prev, email: e.target.value }))
                        }
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="modal-phone">Phone Number *</label>
                      <input
                        id="modal-phone"
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={joinForm.phone}
                        onChange={(e) =>
                          setJoinForm((prev) => ({ ...prev, phone: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="form-field-row">
                    <div className="form-field">
                      <label htmlFor="modal-sponsor">Sponsor / Referral ID (Optional)</label>
                      <input
                        id="modal-sponsor"
                        type="text"
                        placeholder="e.g. KASHVI-778"
                        value={joinForm.sponsorId}
                        onChange={(e) =>
                          setJoinForm((prev) => ({ ...prev, sponsorId: e.target.value }))
                        }
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="modal-state">State</label>
                      <select
                        id="modal-state"
                        value={joinForm.state}
                        onChange={(e) =>
                          setJoinForm((prev) => ({ ...prev, state: e.target.value }))
                        }
                      >
                        <option value="Maharashtra">Maharashtra</option>
                        <option value="Gujarat">Gujarat</option>
                        <option value="Delhi NCR">Delhi NCR</option>
                        <option value="Karnataka">Karnataka</option>
                        <option value="Punjab">Punjab</option>
                        <option value="Rajasthan">Rajasthan</option>
                        <option value="Tamil Nadu">Tamil Nadu</option>
                        <option value="Other">Other State</option>
                      </select>
                    </div>
                  </div>

                  <button type="submit" className="modal-submit-btn">
                    <span>Activate Distributor Account</span>
                    <ArrowRight size={18} />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Product Quick View Modal */}
      {selectedProduct && (
        <div className="vadic-modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div
            className="vadic-modal-dialog product-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="vadic-modal-close"
              onClick={() => setSelectedProduct(null)}
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>

            <div className="product-modal-inner">
              <div className="product-modal-image-side">
                <img
                  src={selectedProduct.img}
                  alt={selectedProduct.name || selectedProduct.title}
                  className="product-modal-large-img"
                />
              </div>

              <div className="product-modal-info-side">
                <span className="product-modal-tag-badge">{selectedProduct.tag}</span>
                <h3 className="product-modal-heading">
                  {selectedProduct.name || selectedProduct.title}
                </h3>
                <p className="product-modal-desc-text">
                  {selectedProduct.desc || selectedProduct.quote}
                </p>

                <div className="product-modal-price-box">
                  <span className="current-price-val">
                    ₹{selectedProduct.price.toLocaleString('en-IN')}
                  </span>
                  <span className="original-price-val">
                    ₹{selectedProduct.originalPrice.toLocaleString('en-IN')}
                  </span>
                  <span className="savings-pill">
                    Save ₹{(selectedProduct.originalPrice - selectedProduct.price).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="product-modal-btn-row">
                  <button
                    type="button"
                    className="btn-add-cart-modal"
                    onClick={() =>
                      handleAddToCart(selectedProduct.name || selectedProduct.title)
                    }
                  >
                    {addedItem === (selectedProduct.name || selectedProduct.title) ? (
                      <>
                        <Check size={18} />
                        <span>Added to Cart!</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag size={18} />
                        <span>Add to Cart</span>
                      </>
                    )}
                  </button>

                  <Link
                    to="/contact"
                    className="btn-view-shop-modal"
                    onClick={() => setSelectedProduct(null)}
                  >
                    <span>Enquire Now</span>
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
