import Image from 'next/image';
import Link from 'next/link';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { MagicLinkForm } from '@/components/auth/magic-link-form';
import { DemoEntry } from '@/components/auth/demo-entry';
import { APP_CONFIG } from '@/lib/constants';

export const dynamic = 'force-dynamic';

function isDemo(): boolean {
  try {
    return getCloudflareContext().env.DEMO_MODE === 'true';
  } catch {
    return false;
  }
}

export default function LoginPage() {
  const demo = isDemo();

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden lg:block">
        <Image
          src="/brand/hero-prayer-team.jpg"
          alt="Favor International partners in prayer"
          fill
          priority
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(31,58,26,0.55) 0%, rgba(31,58,26,0.35) 40%, rgba(31,58,26,0.85) 100%)',
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12 text-[#FFFEF9]">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FFFEF9]/80">
            Favor International
          </span>
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-[#e1a730]">
              Where others will not go
            </p>
            <h1 className="max-w-md text-4xl font-extrabold leading-[1.1] tracking-tight text-[#FFFEF9]">
              Transformed hearts transform nations.
            </h1>
            <p className="mt-4 max-w-sm text-[#FFFEF9]/85">
              Your partnership equips indigenous leaders to bring the gospel to the
              hardest-to-reach places on earth.
            </p>
          </div>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="flex items-center justify-center bg-[#FFFEFA] p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <Image
              src={APP_CONFIG.logo}
              alt="Favor International"
              width={200}
              height={200}
              className="mx-auto mb-3 h-20 w-auto"
              priority
            />
            <p className="font-medium text-[#6f7766]">Partner Portal</p>
          </div>

          {demo ? (
            <div className="mb-6">
              <DemoEntry />
              <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.12em] text-[#8b957b]">
                <span className="h-px flex-1 bg-[#e5e0d6]" />
                or sign in with email
                <span className="h-px flex-1 bg-[#e5e0d6]" />
              </div>
            </div>
          ) : null}

          <MagicLinkForm
            title="Welcome back"
            description="Enter your email for a secure sign-in link."
          />

          <p className="mt-4 text-center text-xs text-[#6f7766]">
            Staff/admin?{' '}
            <Link href="/admin/login" className="font-medium text-[#2b4d24] underline">
              Use admin sign-in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
