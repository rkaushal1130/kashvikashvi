import { IPnbBankingAdapter } from './pnbBankingAdapter.interface';
import { PnbPortalBulkFileAdapter } from './pnbPortalBulkFileAdapter';
import { PnbMockSandboxAdapter } from './pnbMockSandboxAdapter';

export * from './pnbBankingAdapter.interface';
export * from './pnbPortalBulkFileAdapter';
export * from './pnbMockSandboxAdapter';

export class PnbBankingAdapterFactory {
  private static instance: IPnbBankingAdapter | null = null;

  public static getAdapter(): IPnbBankingAdapter {
    if (this.instance) {
      return this.instance;
    }

    const mode = process.env.PNB_BANKING_MODE || 'PORTAL_BULK';

    if (mode === 'SANDBOX' || process.env.NODE_ENV === 'test') {
      this.instance = new PnbMockSandboxAdapter();
    } else {
      // Default production/staging rail: PNB Corporate Internet Banking Bulk Upload
      this.instance = new PnbPortalBulkFileAdapter(
        process.env.PNB_CORPORATE_ACCOUNT_NUMBER || '1923102100000382',
        process.env.PNB_CORPORATE_IFSC || 'PUNB0192310'
      );
    }

    return this.instance;
  }

  public static setAdapter(adapter: IPnbBankingAdapter): void {
    this.instance = adapter;
  }
}
