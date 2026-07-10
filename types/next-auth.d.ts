import 'next-auth';
import { DefaultSession } from 'next-auth';

type UserRole = 'FTF_ADMIN' | 'CLUB_ADMIN';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      clubId?: string;
      clubName?: string;
      clubLogo?: string;
      organizationId?: string;
    } & DefaultSession['user'];
  }

  interface User {
    role: UserRole;
    clubId?: string;
    clubName?: string;
    clubLogo?: string;
    organizationId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole;
    clubId?: string;
    clubName?: string;
    clubLogo?: string;
    organizationId?: string;
    /** Timestamp (ms) de la dernière vérification du statut utilisateur en base. */
    statusCheckedAt?: number;
  }
}
