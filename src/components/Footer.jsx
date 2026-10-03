import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Mail, Phone, ShieldCheck, ChevronRight } from 'lucide-react';
import logoImg from '../assets/logo.png';

/**
 * High-Trust, Corporate Direct-Selling Footer for KASHVIMLM
 * Matching the multi-column format from the reference snapshot:
 * - Column 1: Corporate entity info (CIN, Registered Office, Email, Customer Helpline)
 * - Column 2: Quick Links (Home, About, Products, Plan, Leadership, Documents)
 * - Column 3: Code of Ethics & Policies (Disclaimer, Refund, Shipping, Grievances)
 * - Column 4: Customer Support & Distributor Care
 * - Bottom Bar: Copyright & Rights Reserved
 */
function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-grid">
          {/* Column 1: Corporate Entity Info */}
          <div className="footer-col footer-brand-col">
            <Link to="/" className="footer-brand-header" aria-label="KASHVIMLM Home">
              <img src={logoImg} alt="KASHVI NETWORK PRIVATE LIMITED" className="footer-brand-badge-img" />
            </Link>
            
            <div className="corporate-info-list">
              <div className="corp-info-item">
                <span className="corp-info-label">CIN No</span>
                <span className="corp-info-val">U52339HR2024PTC099841</span>
              </div>

              <div className="corp-info-item">
                <div className="corp-info-icon-title">
                  <MapPin size={15} className="text-cyan-accent" />
                  <span className="corp-info-label">Registered Address</span>
                </div>
                <p className="corp-info-address">
                  Plot No. 43, Shiv TP Nagar, Baldev Nagar, Ambala City, Haryana – 134007 [India]
                </p>
              </div>

              <div className="corp-info-item">
                <div className="corp-info-icon-title">
                  <Mail size={15} className="text-cyan-accent" />
                  <span className="corp-info-label">Email Support</span>
                </div>
                <a href="mailto:kashvicustomercare@gmail.com" className="corp-info-link">
                  kashvicustomercare@gmail.com
                </a>
              </div>

              <div className="corp-info-item">
                <div className="corp-info-icon-title">
                  <Phone size={15} className="text-cyan-accent" />
                  <span className="corp-info-label">Customer Care Helpline</span>
                </div>
                <a href="tel:+917015643886" className="corp-info-link corp-phone-highlight">
                  +91 70156 43886 / +91 1800-202-9900
                </a>
              </div>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="footer-col">
            <h4 className="footer-heading">QUICK LINKS</h4>
            <ul className="footer-links">
              <li><Link to="/" className="footer-link">Home Page</Link></li>
              <li><Link to="/contact" className="footer-link">Contact Us</Link></li>
              <li><Link to="/profile" className="footer-link">Member Profile</Link></li>
              <li><a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>Business Plan &amp; BV Margins</a></li>
              <li><a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>Compliance Documents</a></li>
              <li><a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>List of Directors</a></li>
              <li><a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>Grievance Redressal Officer</a></li>
              <li><a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>List of Direct Sellers</a></li>
            </ul>
          </div>

          {/* Column 3: Code of Ethics & Policies */}
          <div className="footer-col">
            <h4 className="footer-heading">CODE OF ETHICS &amp; POLICIES</h4>
            <ul className="footer-links">
              <li><a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>Disclaimer Clause</a></li>
              <li><a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>Direct Selling Guidelines</a></li>
              <li><a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>Payment &amp; Payout Policy</a></li>
              <li><a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>Cancellation &amp; Refund Policy</a></li>
              <li><a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>Shipping &amp; Delivery Policy</a></li>
              <li><a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>Product Warranty &amp; Exchange</a></li>
              <li><a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>Privacy Policy &amp; Security</a></li>
              <li><a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>Distributor Code of Conduct</a></li>
            </ul>
          </div>

          {/* Column 4: Customer Support & Assurance */}
          <div className="footer-col footer-newsletter-col">
            <h4 className="footer-heading">CUSTOMER SUPPORT</h4>
            <p className="footer-newsletter-desc">
              Need assistance with an order, product warranty, or your distributor BV account? We are here to support you Monday through Saturday, 9:30 AM – 6:30 PM.
            </p>
            <div className="footer-support-actions">
              <Link to="/contact" className="footer-support-cta">
                <span>Online Enquiry</span>
                <ChevronRight size={16} />
              </Link>
              <div className="footer-trust-badge">
                <ShieldCheck size={22} className="text-cyan-accent" />
                <div>
                  <span className="trust-badge-title">100% Verified Direct Selling</span>
                  <span className="trust-badge-sub">Consumer Protection Compliant</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Legal Copyright Row */}
        <div className="footer-bottom-row">
          <p className="footer-bottom-copy">
            Copyright &copy; 2026 <strong>Kashvi Network Private Limited</strong>. All Rights Reserved.
          </p>
          <div className="footer-legal-links">
            <span className="footer-dev-tag">Developed for Kashvi MLM Platform</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
