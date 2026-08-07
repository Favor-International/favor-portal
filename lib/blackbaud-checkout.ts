// Blackbaud Checkout in the portal.
//
// Two jobs, both of which keep card data out of Favor's systems entirely:
//   vaultNewCard          replace the card on an existing monthly gift
//   openBlackbaudCheckout authorize a new gift started inside the portal
//
// The card is always entered in Blackbaud's own window. We receive tokens, not
// card numbers, so the portal stays outside PCI scope exactly like the public
// giving form. Configuration (public key, payment configuration, designations,
// Turnstile site key) comes from favorintl.org's public /api/give/config, the
// same source the public form reads.

declare global {
  interface Window {
    Blackbaud_OpenPaymentForm?: (config: Record<string, unknown>) => void;
    turnstile?: {
      render: (el: string | HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

const SDK_SRC = 'https://payments.blackbaud.com/Checkout/bbCheckout.2.0.js';
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const CONFIG_URL = 'https://favorintl.org/api/give/config';

export interface GiveConfig {
  connected: boolean;
  public_key?: string;
  payment_configuration_id?: string;
  turnstile_site_key?: string | null;
  designations: Array<{ fund_id: string; label: string }>;
  fee_rate?: number;
  fee_fixed?: number;
}

const scriptCache = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Not in a browser'));
  const cached = scriptCache.get(src);
  if (cached) return cached;
  const p = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('A required script failed to load')));
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scriptCache.delete(src);
      reject(new Error('A required script failed to load'));
    };
    document.head.appendChild(el);
  });
  scriptCache.set(src, p);
  return p;
}

let configPromise: Promise<GiveConfig> | null = null;
export function getGiveConfig(): Promise<GiveConfig> {
  if (!configPromise) {
    configPromise = fetch(CONFIG_URL)
      .then((r) => r.json() as Promise<GiveConfig>)
      .then((c) => {
        if (!c.connected || !c.public_key || !c.payment_configuration_id) {
          throw new Error('Giving is briefly unavailable.');
        }
        return c;
      })
      .catch((err) => {
        configPromise = null;
        throw err;
      });
  }
  return configPromise;
}

/** Mount a Turnstile widget and report its token. */
export async function renderTurnstile(
  elementId: string,
  siteKey: string,
  onToken: (token: string) => void
): Promise<void> {
  await loadScript(TURNSTILE_SRC);
  const el = document.getElementById(elementId);
  if (!el || el.childElementCount > 0) return;
  // The API object appears a tick after the script loads.
  for (let i = 0; i < 40 && !window.turnstile; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  window.turnstile?.render(el, { sitekey: siteKey, callback: onToken, theme: 'light' });
}

interface CheckoutOutcome {
  transactionToken: string;
}

interface OpenCheckoutOptions {
  config: GiveConfig;
  amount: number;
  email: string;
  firstName?: string;
  lastName?: string;
  /** Present for monthly gifts: Blackbaud vaults the card under this token. */
  cardToken?: string;
  allowWallets?: boolean;
  description?: string;
}

/**
 * Open Blackbaud Checkout to authorize a gift.
 * Resolves with the transaction token, or null if the partner closes the
 * window without finishing.
 */
export async function openBlackbaudCheckout(opts: OpenCheckoutOptions): Promise<CheckoutOutcome | null> {
  await loadScript(SDK_SRC);
  const { config } = opts;

  return new Promise<CheckoutOutcome | null>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      document.removeEventListener('checkoutComplete', onComplete as EventListener);
      document.removeEventListener('checkoutCancel', onCancel);
      document.removeEventListener('checkoutError', onError);
    };
    const onComplete = (e: Event) => {
      if (settled) return;
      settled = true;
      cleanup();
      // Checkout reports the authorization on the event detail.
      const detail = (e as CustomEvent<{ transactionToken?: string }>).detail ?? {};
      const token = detail.transactionToken;
      if (!token) {
        reject(new Error('The payment did not complete. Please try again.'));
        return;
      }
      resolve({ transactionToken: token });
    };
    const onCancel = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    };
    const onError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('The payment could not be processed. Please try again.'));
    };

    document.addEventListener('checkoutComplete', onComplete as EventListener);
    document.addEventListener('checkoutCancel', onCancel);
    document.addEventListener('checkoutError', onError);

    try {
      // Keys are snake_case. This mirrors the production form on favorintl.org
      // field for field; PascalCase silently opens nothing at all.
      const data: Record<string, unknown> = {
        key: config.public_key,
        payment_configuration_id: config.payment_configuration_id,
        amount: Number(opts.amount.toFixed(2)),
        billing_address_first_name: opts.firstName ?? '',
        billing_address_last_name: opts.lastName ?? '',
        billing_address_email: opts.email,
        client_app_name: 'Favor Partner Portal',
        description: opts.description ?? 'Gift to Favor International',
        primary_color: '#2b4d24',
        is_email_required: true,
        // Wallets cannot be vaulted for reuse, so a monthly schedule would
        // have nothing to charge next month.
        use_apple_pay: false,
      };
      if (opts.cardToken) data.card_token = opts.cardToken;
      window.Blackbaud_OpenPaymentForm?.(data);
    } catch {
      settled = true;
      cleanup();
      reject(new Error('The secure card form could not be opened.'));
    }
  });
}

export interface VaultCardOptions {
  email: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Open Blackbaud Checkout purely to save a card, for replacing the card on an
 * existing monthly gift. Resolves with the card token, or null if cancelled.
 */
export async function vaultNewCard(opts: VaultCardOptions): Promise<string | null> {
  const config = await getGiveConfig();
  const cardToken = crypto.randomUUID();
  const outcome = await openBlackbaudCheckout({
    config,
    // Zero-dollar: this saves the card, it does not take money. The schedule
    // keeps its own amount.
    amount: 0,
    email: opts.email,
    firstName: opts.firstName,
    lastName: opts.lastName,
    cardToken,
    allowWallets: false,
  }).catch((err) => {
    throw err instanceof Error ? err : new Error('The card could not be saved.');
  });
  return outcome ? cardToken : null;
}
