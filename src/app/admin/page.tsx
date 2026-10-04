import { isLocalMode } from '@/lib/runtime';
export const dynamic = 'force-dynamic';
import { Admin } from '@/components/admin';
import { vercelStaffReady } from '@/lib/vercel-staff';
export const metadata = { title: 'مساحة اللجنة' };
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ login?: string }>;
}) {
  const params = await searchParams;
  return (
    <Admin
      demo={isLocalMode()}
      staffAuth={process.env.NBC_STAFF_AUTH === 'vercel' ? 'vercel' : 'cloudflare'}
      signInReady={vercelStaffReady()}
      loginFailed={params.login === 'failed'}
    />
  );
}
