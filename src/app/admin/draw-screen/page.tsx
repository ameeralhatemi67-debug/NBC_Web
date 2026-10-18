import { PrizeDrawScreen } from '@/components/prize-draw-screen';
export const metadata = { title: 'شاشة سحب الجوائز' };
// The projector view for the prize draw. Its data comes from an admin-only API.
export default function DrawScreenPage() {
  return <PrizeDrawScreen />;
}
