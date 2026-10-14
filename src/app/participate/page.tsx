import { Header, Footer } from '@/components/ui';
import { SimulationEntry } from '@/components/simulation-entry';
import { Participation } from '@/components/participation';
export const metadata = { title: 'مساحة المشاركة' };
export default async function Participate({
  searchParams,
}: {
  searchParams: Promise<{ practice?: string | string[] }>;
}) {
  const query = await searchParams;
  const practice = typeof query.practice === 'string' ? query.practice : undefined;
  return (
    <>
      <Header />
      <main id="main" className="container inner-page">
        {!practice && <SimulationEntry />}
        <Participation key={practice ?? 'official'} practiceRunId={practice} />
      </main>
      <Footer />
    </>
  );
}
