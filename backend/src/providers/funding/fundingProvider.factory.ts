import { IFundingProvider } from './fundingProvider.interface';
import { MockFundingProvider } from './mockFundingProvider';
import { RazorpayXFundingProvider } from './razorpayXFundingProvider';
import { logger } from '../../config/logger';

/**
 * ============================================================================
 * FUNDING PROVIDER FACTORY (PROMPT 32)
 * ============================================================================
 *
 * Pluggable registry and factory for resolving corporate banking/payment providers.
 *
 * Ensures controllers and domain services NEVER hardcode a specific banking provider.
 * The active provider is resolved dynamically from environment configuration.
 */
export class FundingProviderFactory {
  private static instance: IFundingProvider | null = null;
  private static registeredProviders: Map<string, () => IFundingProvider> = new Map();

  static {
    // Register built-in providers
    this.registerProvider('MOCK', () => new MockFundingProvider());
    this.registerProvider('MOCK_SANDBOX', () => new MockFundingProvider());
    this.registerProvider('RAZORPAYX', () => new RazorpayXFundingProvider());
  }

  /**
   * Registers a new provider constructor in the factory.
   */
  public static registerProvider(
    name: string,
    factoryOrInstance: (() => IFundingProvider) | IFundingProvider
  ): void {
    const factoryFn =
      typeof factoryOrInstance === 'function' ? factoryOrInstance : () => factoryOrInstance;
    this.registeredProviders.set(name.toUpperCase(), factoryFn);
  }

  /**
   * Directly sets the active provider instance (ideal for automated unit/integration tests).
   */
  public static setProvider(provider: IFundingProvider | null): void {
    this.instance = provider;
  }

  /**
   * Resolves the configured active funding provider.
   * Uses process.env.FUNDING_PROVIDER (default: 'MOCK' in dev/test, 'RAZORPAYX' in prod).
   */
  public static getProvider(overrideName?: string): IFundingProvider {
    if (this.instance && !overrideName) {
      return this.instance;
    }

    const providerName = (
      overrideName ||
      process.env.FUNDING_PROVIDER ||
      (process.env.NODE_ENV === 'production' ? 'RAZORPAYX' : 'MOCK')
    )
      .trim()
      .toUpperCase();

    const factoryFn = this.registeredProviders.get(providerName);
    if (!factoryFn) {
      logger.warn(
        { requestedProvider: providerName },
        `Funding provider '${providerName}' not registered. Falling back to MOCK_SANDBOX.`
      );
      this.instance = new MockFundingProvider();
      return this.instance;
    }

    this.instance = factoryFn();
    logger.info({ providerName }, `Resolved active funding provider: ${this.instance.providerName}`);
    return this.instance;
  }

  /**
   * Resets active singleton instance to allow fresh resolution.
   */
  public static reset(): void {
    this.instance = null;
    this.registeredProviders.set('MOCK', () => new MockFundingProvider());
    this.registeredProviders.set('MOCK_SANDBOX', () => new MockFundingProvider());
    this.registeredProviders.set('RAZORPAYX', () => new RazorpayXFundingProvider());
  }
}

