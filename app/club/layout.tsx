import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import ProvidersWrapper from '@/components/ProvidersWrapper';

export default async function ClubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session || session.user.role !== 'CLUB_ADMIN') {
    redirect('/login');
  }

  return (
    <ProvidersWrapper>
      <div className="min-h-screen">
        <Navbar />
        <div className="flex">
          <Sidebar role="CLUB_ADMIN" />
          <main className="flex-1 ml-64 p-8 pt-6">
            {children}
          </main>
        </div>
      </div>
    </ProvidersWrapper>
  );
}

