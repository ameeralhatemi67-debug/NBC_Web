import { CeremonyStudio } from '@/components/ceremony/ceremony-studio';
export const metadata = { title: 'التدشين' };
// The projector view of the launch ceremony: the stage alone, filling the screen. It holds no
// competition data and changes nothing; the controls appear when the pointer nears the bottom.
export default function CeremonyScreenPage() {
  return <CeremonyStudio screen />;
}
