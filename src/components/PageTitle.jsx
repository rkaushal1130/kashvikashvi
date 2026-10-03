import React from 'react';

/**
 * Reusable PageTitle component.
 * Renders the clean card containing KASHVIMLM brand pill,
 * centered title heading, and dual-tone accent line.
 */
function PageTitle({ title }) {
  return (
    <div className="page-card">
      <span className="page-brand-tag">
        <span className="page-brand-dot" aria-hidden="true" />
        KASHVIMLM
      </span>
      <h1 className="page-heading">{title}</h1>
      <span className="page-accent-line" aria-hidden="true" />
    </div>
  );
}

export default PageTitle;
