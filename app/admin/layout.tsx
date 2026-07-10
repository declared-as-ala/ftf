import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import ProvidersWrapper from '@/components/ProvidersWrapper';

export const metadata: Metadata = {
  title: "FTF - Fédération Tunisienne de Football",
  description: "Système de gestion de la Fédération Tunisienne de Football",
  icons: { icon: "/icon.png" },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session || session.user.role !== 'FTF_ADMIN') {
    redirect('/login');
  }

  return (
    <ProvidersWrapper>
      <div className="min-h-screen">
        <Navbar />
        <div className="flex">
          <Sidebar role="FTF_ADMIN" />
          <main className="flex-1 ml-16 md:ml-64 p-8 pt-6 transition-all duration-200">
            {children}
          </main>
        </div>
      </div>
    </ProvidersWrapper>
  );
}

