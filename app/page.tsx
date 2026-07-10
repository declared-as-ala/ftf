import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function Home() {
  const session = await auth();

  if (session) {
    if (session.user.role === 'FTF_ADMIN') {
      redirect('/admin');
    } else {
      redirect('/club');
    }
  }

  redirect('/login');
}
