import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Clear legacy cached member and mock data on boot
if (typeof window !== 'undefined') {
  const legacyMockKeys = [
    'kashvi_registered_users',
    'kashvi_enrolled_tree_members',
    'kashvi_tree_audit_logs',
    'kashvi_wallet_balance',
    'kashvi_downline_team',
    'kashvi_client_bank_accounts',
    'kashvi_referral_sponsor',
    'kashvi_active_sponsor',
  ];
  legacyMockKeys.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
