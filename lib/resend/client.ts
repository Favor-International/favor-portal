import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export interface EmailOptions {
  to: string | string[];
  subject: string;
  from?: string;
  // Where a human reply lands. sendEmail rebuilds the Resend payload field by
  // field, so anything not forwarded below is dropped on the floor.
  replyTo?: string | string[];
}

export type SendEmailOptions =
  | (EmailOptions & { html: string; text?: string })
  | (EmailOptions & { text: string; html?: never });

function hasHtml(options: SendEmailOptions): options is EmailOptions & { html: string; text?: string } {
  return typeof (options as { html?: string }).html === 'string';
}

export async function sendEmail(options: SendEmailOptions) {
  // RESEND_FROM overrides the default sender. Until favorintl.org is verified
  // in Resend (DNS records pending), set RESEND_FROM to an address on a
  // verified domain (e.g. onboarding@resend.dev for owner-only test sends).
  const from = options.from || process.env.RESEND_FROM || 'Favor International <noreply@favorintl.org>';

  if (!resend) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY is required in production.');
    }
    console.log('Resend not configured, skipping email send in development:', {
      to: options.to,
      subject: options.subject,
    });
    return { success: true, id: 'dev-email-skip' };
  }
  
  try {
    const { data, error } = hasHtml(options)
      ? await resend.emails.send({
          from,
          to: options.to,
          subject: options.subject,
          ...(options.replyTo ? { replyTo: options.replyTo } : {}),
          html: options.html,
          text: options.text,
        })
      : await resend.emails.send({
          from,
          to: options.to,
          subject: options.subject,
          text: options.text,
        });

    if (error) {
      console.error('Resend error:', error);
      throw error;
    }

    return { success: true, id: data?.id };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

export async function sendMagicLinkEmail(email: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const verificationUrl = `${baseUrl}/verify?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Favor International Login Link</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #FFFEF9; font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #FFFFFF; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 3px solid #2b4d24;">
                    <img src="https://storage.googleapis.com/msgsndr/LblL0AiRWSIvV6fFQuRT/media/67bf4d8383ae0d6d7dc507fe.png" alt="Favor International" style="max-width: 200px; height: auto;">
                  </td>
                </tr>
                
                <!-- Body -->
                <tr>
                  <td style="padding: 40px;">
                    <h1 style="margin: 0 0 20px; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 28px; font-weight: 400; color: #1a1a1a; text-align: center;">
                      Welcome Back to Your Partner Portal
                    </h1>
                    
                    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #333333; text-align: center;">
                      Click the button below to securely access your Favor International account. This link will expire in 1 hour.
                    </p>
                    
                    <table role="presentation" style="width: 100%; margin: 32px 0;">
                      <tr>
                        <td align="center">
                          <a href="${verificationUrl}" style="display: inline-block; padding: 16px 32px; background-color: #2b4d24; color: #FFFFFF; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: 500;">
                            Access My Portal
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 24px 0 0; font-size: 14px; line-height: 1.5; color: #666666; text-align: center;">
                      If you didn't request this login link, you can safely ignore this email.
                    </p>
                    
                    <p style="margin: 16px 0 0; font-size: 12px; color: #999999; text-align: center;">
                      Or copy and paste this URL into your browser:<br>
                      <span style="color: #2b4d24;">${verificationUrl}</span>
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 40px; background-color: #1a1a1a; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: #999999;">
                      Transformed Hearts Transform Nations
                    </p>
                    <p style="margin: 8px 0 0; font-size: 12px; color: #666666;">
                      Favor International, Inc. | 3433 Lithia Pinecrest Rd. #356, Valrico, FL 33596
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Your Favor International Login Link',
    html,
  });
}

export async function sendTaxReceiptEmail(email: string, year: number, downloadUrl: string) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your ${year} Tax Receipt is Ready</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #FFFEF9; font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #FFFFFF; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 3px solid #2b4d24;">
                    <img src="https://storage.googleapis.com/msgsndr/LblL0AiRWSIvV6fFQuRT/media/67bf4d8383ae0d6d7dc507fe.png" alt="Favor International" style="max-width: 200px; height: auto;">
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px;">
                    <h1 style="margin: 0 0 20px; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 28px; font-weight: 400; color: #1a1a1a; text-align: center;">
                      Your ${year} Tax Receipt is Ready
                    </h1>
                    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #333333; text-align: center;">
                      Thank you for your generous support of Favor International. Your tax receipt for ${year} is now available in your partner portal.
                    </p>
                    <table role="presentation" style="width: 100%; margin: 32px 0;">
                      <tr>
                        <td align="center">
                          <a href="${downloadUrl}" style="display: inline-block; padding: 16px 32px; background-color: #2b4d24; color: #FFFFFF; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: 500;">
                            Download Tax Receipt
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 24px 0 0; font-size: 14px; line-height: 1.5; color: #666666; text-align: center;">
                      Favor International, Inc. is a 501(c)(3) nonprofit organization. Your contributions are tax-deductible to the fullest extent allowed by law.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 40px; background-color: #1a1a1a; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: #999999;">
                      Transformed Hearts Transform Nations
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Your ${year} Tax Receipt is Ready`,
    html,
  });
}

export interface WelcomeEmailInput {
  firstName: string;
  amount: number;
  frequency: 'once' | 'monthly';
  designation: string;
  loginUrl: string;
}

// Sent right after an online gift creates (or matches) a portal account.
// One button, one job: get the donor into their giving dashboard.
export async function sendWelcomeEmail(email: string, input: WelcomeEmailInput) {
  const money = input.amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: input.amount % 1 ? 2 : 0,
  });
  const giftLine =
    input.frequency === 'monthly'
      ? `Your ${money} monthly partnership is active, designated to ${input.designation}.`
      : `Your ${money} gift is on its way to the field, designated to ${input.designation}.`;
  const heading =
    input.frequency === 'monthly' ? 'Welcome, Favor Partner.' : 'Thank you. Your gift is on its way to the field.';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to your Favor giving dashboard</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #FFFEF9; font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #FFFFFF; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 3px solid #2b4d24;">
                    <img src="https://storage.googleapis.com/msgsndr/LblL0AiRWSIvV6fFQuRT/media/67bf4d8383ae0d6d7dc507fe.png" alt="Favor International" style="max-width: 200px; height: auto;">
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px;">
                    <h1 style="margin: 0 0 20px; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 28px; font-weight: 400; color: #1a1a1a; text-align: center;">
                      ${heading}
                    </h1>
                    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #333333; text-align: center;">
                      ${input.firstName ? input.firstName + ', y' : 'Y'}our generosity puts indigenous missionaries on the ground in places others will not go. ${giftLine}
                    </p>
                    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #333333; text-align: center;">
                      We created your giving dashboard, where you can see your history, download receipts, and manage your monthly giving anytime.
                    </p>
                    <table role="presentation" style="width: 100%; margin: 32px 0;">
                      <tr>
                        <td align="center">
                          <a href="${input.loginUrl}" style="display: inline-block; padding: 16px 32px; background-color: #2b4d24; color: #FFFFFF; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: 500;">
                            Open My Giving Dashboard
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 24px 0 0; font-size: 14px; line-height: 1.5; color: #666666; text-align: center;">
                      This sign-in link expires in 15 minutes. Need a new one anytime? Enter your email on the portal login page and we will send it.
                    </p>
                    <p style="margin: 16px 0 0; font-size: 12px; color: #999999; text-align: center;">
                      Your official tax receipt arrives separately from Blackbaud, Favor's donation processor.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 40px; background-color: #1a1a1a; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: #999999;">
                      Transformed Hearts Transform Nations
                    </p>
                    <p style="margin: 8px 0 0; font-size: 12px; color: #666666;">
                      Favor International is a 501(c)(3) public charity. | 3433 Lithia Pinecrest Rd. #356, Valrico, FL 33596
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: input.frequency === 'monthly' ? 'Welcome, Favor Partner. Your dashboard is ready.' : 'Thank you for your gift. Your dashboard is ready.',
    html,
  });
}
