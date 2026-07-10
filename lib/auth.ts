import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { UserRole } from './models/User';

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error(
    'NEXTAUTH_SECRET is not set. Copy .env.example to .env.local and set a secret (openssl rand -base64 32).'
  );
}

// Revalidation du statut utilisateur (suspension/désactivation) sans re-login.
const STATUS_REVALIDATE_MS = 10 * 60 * 1000;

/** Compat lecture : anciennes valeurs de rôle ('ADMIN'/'CLUB') → nouvelles. */
function normalizeRole(role: string): UserRole {
  if (role === 'ADMIN') return 'FTF_ADMIN';
  if (role === 'CLUB') return 'CLUB_ADMIN';
  return role as UserRole;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Charger dynamiquement pour éviter Edge Runtime issues
          const { verifyCredentials } = await import('./auth-core');
          return await verifyCredentials(
            credentials.email.toString(),
            credentials.password.toString()
          );
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.clubId = user.clubId;
        token.clubName = user.clubName;
        token.clubLogo = user.clubLogo;
        token.organizationId = user.organizationId;
        token.statusCheckedAt = Date.now();
      }

      // Compat : sessions émises avant la migration des rôles
      token.role = normalizeRole(token.role as string);

      // Revalidation périodique du statut — runtime Node uniquement
      // (le middleware Edge ne peut pas charger mongoose)
      if (!user && token.sub && process.env.NEXT_RUNTIME !== 'edge') {
        const checkedAt = (token.statusCheckedAt as number | undefined) ?? 0;
        if (Date.now() - checkedAt > STATUS_REVALIDATE_MS) {
          try {
            const { default: connectDB } = await import('./db');
            const { default: User } = await import('./models/User');
            await connectDB();

            const dbUser = await User.findById(token.sub).select('status');
            if (!dbUser || (dbUser.status && dbUser.status !== 'ACTIVE')) {
              // Compte supprimé/suspendu/désactivé ⇒ session invalidée
              return null;
            }
            token.statusCheckedAt = Date.now();
          } catch {
            // Base momentanément indisponible : on conserve la session
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as UserRole;
        session.user.clubId = token.clubId as string | undefined;
        session.user.clubName = token.clubName as string | undefined;
        session.user.clubLogo = token.clubLogo as string | undefined;
        session.user.organizationId = token.organizationId as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  debug: false,
});
