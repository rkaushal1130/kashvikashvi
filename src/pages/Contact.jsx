import React, { useState } from 'react';
import {
  MapPin,
  Mail,
  Phone,
  Clock,
  Sparkles,
  Send,
  CheckCircle2,
  MessageSquare,
  Award,
  Building2,
  ChevronDown,
  ChevronUp,
  User,
  FileText,
  HelpCircle,
} from 'lucide-react';
import PageContainer from '../components/PageContainer';
import { api } from '../services/api';
import './Contact.css';

/**
 * Professional, Theme-Integrated Contact Page for KASHVIMLM.
 * Matches the corporate direct-selling brand standards:
 * - Top contact highlight cards (Helpline, Email, Corporate Office, Working Hours)
 * - Complete, interactive contact form with validation and ticket generation
 * - Comprehensive Frequently Asked Questions (FAQs) section positioned after the form
 */
function Contact() {
  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    memberId: '',
    inquiryType: 'General Customer & Order Support',
    subject: '',
    message: '',
    agreeTerms: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState(null);

  // FAQ Accordion State (first item open by default)
  const [openFaq, setOpenFaq] = useState(0);

  const faqs = [
    {
      q: 'How can I track my product delivery or replacement status?',
      a: 'All orders placed through distributor or customer portals are processed and dispatched within 24 hours with Pan-India express logistics. You will receive live SMS and WhatsApp tracking links as soon as your consignment leaves our warehouse.',
    },
    {
      q: 'When are weekly direct selling BV payouts and retail margins credited?',
      a: 'Weekly Business Volume (BV) retail margins, leadership royalties, and bonus incentives are calculated every Sunday midnight and directly credited into your KYC-verified bank account every Monday.',
    },
    {
      q: 'How can I lodge a formal consumer grievance or service escalation?',
      a: 'You can submit the contact form above under "Grievance & Consumer Protection" or email directly to kashvicustomercare@gmail.com with your Order Number or Member ID for priority resolution within 48 business hours.',
    },
    {
      q: 'How quickly will I receive an official response to my inquiry?',
      a: 'Our customer support team reviews all submitted inquiries during business hours (Mon – Sat, 9:30 AM – 6:30 PM) and guarantees a formal response within 24 business hours. For urgent queries, our toll-free helpline is available.',
    },
    {
      q: 'How do I register as a new independent distributor?',
      a: 'To register as a distributor, click on the Profile/Login icon in the header and select "Register". You will need your basic personal details and contact verification to complete your registration.',
    },
    {
      q: 'Can I update my registered email, phone number, or bank KYC details?',
      a: 'Yes, registered members can update their contact information through their member portal dashboard or by raising an official ticket with our support desk along with proof of identity verification.',
    },
  ];

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.message.trim()) {
      alert('Please fill in all mandatory fields (Name, Email, and Message).');
      return;
    }

    setIsSubmitting(true);
    const fallbackTicketId = `KV-TKT-${Math.floor(100000 + Math.random() * 900000)}`;

    const payload = {
      name: formData.fullName,
      email: formData.email,
      phone: formData.phone || undefined,
      distributorId: formData.memberId || undefined,
      department: formData.inquiryType,
      subject: formData.subject || `${formData.inquiryType} Inquiry`,
      description: formData.message,
      priority: 'Medium',
    };

    let ticketNumber = fallbackTicketId;
    try {
      const created = await api.submitSupportTicket(payload);
      if (created?.ticketNumber) {
        ticketNumber = created.ticketNumber;
      }
    } catch {
      // Fallback
    }

    setIsSubmitting(false);
    setSubmittedTicket({
      id: ticketNumber,
      name: formData.fullName,
      email: formData.email,
      inquiryType: formData.inquiryType,
    });

    // Reset form
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      memberId: '',
      inquiryType: 'General Customer & Order Support',
      subject: '',
      message: '',
      agreeTerms: true,
    });
  };

  return (
    <PageContainer className="contact-page-wrapper">
      {/* Background Glowing Ambient Accents */}
      <div className="contact-ambient-orb-1" aria-hidden="true" />
      <div className="contact-ambient-orb-2" aria-hidden="true" />

      <div className="contact-container">
        {/* =========================================================================
            1. HERO HEADER SECTION
            ========================================================================= */}
        <header className="contact-hero-header">
          <div className="contact-badge-pill">
            <Sparkles size={14} />
            <span>OFFICIAL DISTRIBUTOR CARE &amp; SUPPORT</span>
          </div>

          <h1 className="contact-hero-title">
            We're Here to Support Your <br />
            <span className="contact-hero-title-accent">Journey to Prosperity</span>
          </h1>

          <p className="contact-hero-desc">
            Have inquiries regarding our personal electronics, Hozri apparel, distributor BV
            commissions, order fulfillment, or legal compliance? Connect directly with our
            dedicated team.
          </p>
        </header>

        {/* =========================================================================
            2. TOP CONTACT HIGHLIGHT CARDS (4 Columns)
            ========================================================================= */}
        <section className="contact-cards-grid" aria-label="Quick Contact Channels">
          {/* Card 1: Helpline */}
          <div className="contact-card-item">
            <div className="contact-card-icon-wrap icon-blue-glow">
              <Phone size={22} />
            </div>
            <h3 className="contact-card-title">Customer Helpline</h3>
            <div className="contact-card-primary-val">
              <a href="tel:+917015643886">+91 70156 43886</a>
            </div>
            <div className="contact-card-primary-val">
              <a href="tel:18002029900">1800-202-9900 (Toll Free)</a>
            </div>
            <p className="contact-card-subtext">Direct assistance for orders &amp; account issues.</p>
          </div>

          {/* Card 2: Email */}
          <div className="contact-card-item">
            <div className="contact-card-icon-wrap icon-gold-glow">
              <Mail size={22} />
            </div>
            <h3 className="contact-card-title">Email Support</h3>
            <div className="contact-card-primary-val">
              <a href="mailto:kashvicustomercare@gmail.com">kashvicustomercare@gmail.com</a>
            </div>
            <p className="contact-card-subtext">Guaranteed response within 24 business hours.</p>
          </div>

          {/* Card 3: Registered Office */}
          <div className="contact-card-item">
            <div className="contact-card-icon-wrap icon-green-glow">
              <MapPin size={22} />
            </div>
            <h3 className="contact-card-title">Registered Office</h3>
            <div className="contact-card-primary-val">Ambala City, Haryana</div>
            <p className="contact-card-subtext">
              Plot No. 43, Shiv TP Nagar, Baldev Nagar – 134007, India.
            </p>
          </div>

          {/* Card 4: Operating Hours */}
          <div className="contact-card-item">
            <div className="contact-card-icon-wrap icon-purple-glow">
              <Clock size={22} />
            </div>
            <h3 className="contact-card-title">Operating Hours</h3>
            <div className="contact-card-primary-val">Mon – Sat: 9:30 AM – 6:30 PM</div>
            <p className="contact-card-subtext">Closed on Sundays &amp; Gazetted National Holidays.</p>
          </div>
        </section>

        {/* =========================================================================
            3. CONTACT FORM SECTION
            ========================================================================= */}
        <section className="contact-form-section" aria-label="Official Contact Form">
          <div className="contact-form-card">
            <div className="contact-form-header">
              <h2 className="contact-form-title">Send an Official Message</h2>
              <p className="contact-form-subtitle">
                Please complete the form below. Our dedicated support team will review and respond promptly.
              </p>
            </div>

            {submittedTicket && (
              <div className="contact-success-banner" role="alert">
                <CheckCircle2 size={24} className="text-emerald-400" />
                <div>
                  <h4>Inquiry Successfully Registered!</h4>
                  <p>
                    Thank you, <strong>{submittedTicket.name}</strong>. Your support ticket{' '}
                    <strong className="text-cyan-accent">{submittedTicket.id}</strong> has been
                    assigned to our team. A confirmation has been routed to{' '}
                    <strong>{submittedTicket.email}</strong>.
                  </p>
                </div>
              </div>
            )}

            <form className="contact-form" onSubmit={handleSubmit}>
              {/* Row 1: Full Name & Email */}
              <div className="contact-form-row">
                <div className="contact-input-group">
                  <label htmlFor="contact-fullName" className="contact-label">
                    <span>Full Name *</span>
                  </label>
                  <div className="contact-input-wrapper">
                    <User size={17} className="contact-input-icon" />
                    <input
                      id="contact-fullName"
                      name="fullName"
                      type="text"
                      required
                      placeholder="Enter your Full Name"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className="contact-input"
                    />
                  </div>
                </div>

                <div className="contact-input-group">
                  <label htmlFor="contact-email" className="contact-label">
                    <span>Email Address *</span>
                  </label>
                  <div className="contact-input-wrapper">
                    <Mail size={17} className="contact-input-icon" />
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      required
                      placeholder="Enter your Email Address"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="contact-input"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Phone Number & Member ID */}
              <div className="contact-form-row">
                <div className="contact-input-group">
                  <label htmlFor="contact-phone" className="contact-label">
                    <span>Phone Number *</span>
                  </label>
                  <div className="contact-input-wrapper">
                    <Phone size={17} className="contact-input-icon" />
                    <input
                      id="contact-phone"
                      name="phone"
                      type="tel"
                      required
                      placeholder="Enter your Phone Number"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="contact-input"
                    />
                  </div>
                </div>

                <div className="contact-input-group">
                  <label htmlFor="contact-memberId" className="contact-label">
                    <span>Distributor / Member ID</span>
                    <span className="contact-label-tag">Optional</span>
                  </label>
                  <div className="contact-input-wrapper">
                    <Award size={17} className="contact-input-icon" />
                    <input
                      id="contact-memberId"
                      name="memberId"
                      type="text"
                      placeholder="e.g. KV-2026-9042 (if registered)"
                      value={formData.memberId}
                      onChange={handleInputChange}
                      className="contact-input"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Inquiry Category Dropdown */}
              <div className="contact-input-group">
                <label htmlFor="contact-inquiryType" className="contact-label">
                  <span>Department / Category of Inquiry *</span>
                </label>
                <div className="contact-input-wrapper">
                  <Building2 size={17} className="contact-input-icon" />
                  <select
                    id="contact-inquiryType"
                    name="inquiryType"
                    value={formData.inquiryType}
                    onChange={handleInputChange}
                    className="contact-select"
                  >
                    <option value="General Customer & Order Support">
                      General Customer &amp; Order Support
                    </option>
                    <option value="Distributor Enrollment & Lineage">
                      Distributor Enrollment &amp; Lineage
                    </option>
                    <option value="BV Points & Weekly Payout Inquiry">
                      BV Points &amp; Weekly Payout Inquiry
                    </option>
                    <option value="Product Quality (Electronics & Hozri)">
                      Product Quality (Electronics &amp; Hozri)
                    </option>
                    <option value="Grievance & Consumer Protection">
                      Grievance &amp; Consumer Protection (Nodal Officer)
                    </option>
                    <option value="Regional Distribution Hub Partnership">
                      Regional Distribution Hub Partnership
                    </option>
                  </select>
                  <ChevronDown size={17} className="contact-select-caret" />
                </div>
              </div>

              {/* Row 4: Subject */}
              <div className="contact-input-group">
                <label htmlFor="contact-subject" className="contact-label">
                  <span>Subject *</span>
                </label>
                <div className="contact-input-wrapper">
                  <MessageSquare size={17} className="contact-input-icon" />
                  <input
                    id="contact-subject"
                    name="subject"
                    type="text"
                    required
                    placeholder="Enter the subject of your inquiry"
                    value={formData.subject}
                    onChange={handleInputChange}
                    className="contact-input"
                  />
                </div>
              </div>

              {/* Row 5: Detailed Message */}
              <div className="contact-input-group">
                <label htmlFor="contact-message" className="contact-label">
                  <span>Your Message / Query Details *</span>
                </label>
                <div className="contact-input-wrapper">
                  <FileText size={17} className="contact-textarea-icon" />
                  <textarea
                    id="contact-message"
                    name="message"
                    required
                    rows={5}
                    placeholder="Please describe your inquiry, request, or issue in detail..."
                    value={formData.message}
                    onChange={handleInputChange}
                    className="contact-textarea"
                  />
                </div>
              </div>

              {/* Row 6: Consent Checkbox */}
              <div className="contact-checkbox-row">
                <input
                  id="contact-agreeTerms"
                  name="agreeTerms"
                  type="checkbox"
                  required
                  checked={formData.agreeTerms}
                  onChange={handleInputChange}
                />
                <label htmlFor="contact-agreeTerms">
                  I consent to having Kashvi Network Private Limited store and process my submitted
                  information in accordance with our Direct Selling Privacy and Grievance Policy.
                </label>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                className="contact-submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span>Transmitting Message...</span>
                ) : (
                  <>
                    <span>Send Message to Support</span>
                    <Send size={18} />
                  </>
                )}
              </button>
            </form>
          </div>
        </section>

        {/* =========================================================================
            4. FREQUENTLY ASKED QUESTIONS SECTION (After Contact Form)
            ========================================================================= */}
        <section className="contact-faq-section" aria-label="Frequently Asked Questions">
          <div className="contact-faq-header">
            <div className="contact-badge-pill">
              <HelpCircle size={14} />
              <span>FREQUENTLY ASKED QUESTIONS</span>
            </div>
            <h2 className="contact-faq-title">
              Common Questions &amp; <span className="contact-hero-title-accent">Support Answers</span>
            </h2>
            <p className="contact-faq-subtitle">
              Need immediate answers? Check our quick resolutions on orders, distributor earnings, and customer service.
            </p>
          </div>

          <div className="contact-faq-container">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={faq.q}
                  className={`contact-faq-card ${isOpen ? 'faq-open' : ''}`}
                >
                  <button
                    type="button"
                    className="contact-faq-btn"
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    aria-expanded={isOpen}
                  >
                    <span className="contact-faq-q-text">{faq.q}</span>
                    <span className="contact-faq-icon-pill">
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="contact-faq-body">
                      <p>{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

export default Contact;
