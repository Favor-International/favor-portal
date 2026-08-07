// Blackbaud Checkout in the portal.
//
// Used for the one thing the portal must do with a card: let a monthly
// partner replace the card their gift is charged to. The card is entered in
// Blackbaud's own iframe and vaulted by Blackbaud; we only ever receive a
// token, so the portal stays outside PCI scope exactly like the public
// giving form.
//
// The public key and payment configuration come from favorintl.org's public
// /api/give/config, which is the same pair the donate form uses.

declare global {
  interface Window {
    Blackbaud_OpenPaymentForm?: (config: Record<string, unknown>) => void;
    bbCheckout?: unknown;
  }
}

const SDK_SRC = 'https://payments.blackbaud.com/Checkout/bbCheckout.2.0.js';
const CONFIG_URL = 'https://favorintl.org/api/give/config';

let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Not in a browser'));
  if (window.Blackbaud_OpenPaymentForm) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load the secure card form')));
      return;
    }
    const el = document.createElement('script');
    el.src = SDK_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      sdkPromise = null;
      reject(new Error('Could not load the secure card form'));
    };
    document.head.appendChild(el);
  });
  return sdkPromise;
}

interface GiveConfig {
  connected: boolean;
  public_key?: string;
  payment_configuration_id?: string;
}

let configPromise: Promise<GiveConfig> | null = null;
function loadConfig(): Promise<GiveConfig> {
  if (!configPromise) {
    configPromise = fetch(CONFIG_URL)
      .then((r) => r.json() as Promise<GiveConfig>)
      .catch((err) => {
        configPromise = null;
        throw err;
      });
  }
  return configPromise;
}

export interface VaultCardOptions {
  email: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Open Blackbaud Checkout to capture and vault a card.
 * Resolves with the card token once Blackbaud confirms, or null if the
 * partner closes the window without finishing.
 */
export async function vaultNewCard(opts: VaultCardOptions): Promise<string | null> {
  const [, config] = await Promise.all([loadSdk(), loadConfig()]);
  if (!config.connected || !config.public_key || !config.payment_configuration_id) {
    throw new Error('Card updates are briefly unavailable. Please try again shortly.');
  }
  const cardToken = crypto.randomUUID();

  return new Promise<string | null>((resolve, reject) => {
    let settled = false;
    const done = (value: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    // Checkout reports outcomes on the document, not through a callback.
    const onComplete = () => done(cardToken);
    const onCancel = () => done(null);
    const onError = () => fail(new Error('The card could not be saved. Please try again.'));
    const cleanup = () => {
      document.removeEventListener('checkoutComplete', onComplete);
      document.removeEventListener('checkoutCancel', onCancel);
      document.removeEventListener('checkoutError', onError);
    };
    document.addEventListener('checkoutComplete', onComplete);
    document.addEventListener('checkoutCancel', onCancel);
    document.addEventListener('checkoutError', onError);

    try {
      window.Blackbaud_OpenPaymentForm?.({
        Key: config.public_key,
        PaymentConfigurationId: config.payment_configuration_id,
        // Zero-dollar: this saves the card, it does not take money. The
        // schedule keeps its own amount.
        Amount: 0,
        CardToken: cardToken,
        UseCardTokenization: true,
        // Wallets do not tokenize for reuse, so they are not offered here.
        AllowDigitalWallets: false,
        BillingAddressCapture: true,
        Email: opts.email,
        FirstName: opts.firstName ?? '',
        LastName: opts.lastName ?? '',
      });
    } catch {
      fail(new Error('The secure card form could not be opened.'));
    }
  });
}
