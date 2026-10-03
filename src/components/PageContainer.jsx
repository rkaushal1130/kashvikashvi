import React from 'react';

/**
 * Reusable PageContainer component.
 * Provides responsive layout wrapper with consistent padding, centering, and max-width.
 */
function PageContainer({ children, className = '' }) {
  return (
    <div className={`page-container ${className}`.trim()}>
      {children}
    </div>
  );
}

export default PageContainer;
