import { isLocalMode } from '@/lib/runtime';
export const dynamic = 'force-dynamic';
import { Admin } from '@/components/admin';
export const metadata = { title: 'مساحة اللجنة' };
export default function AdminPage() {
  return <Admin demo={isLocalMode()} />;
}
