import bcrypt from 'bcryptjs';
import connectDB from './db';
import User, { type UserRole } from './models/User';

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export interface VerifiedUser {
  id: string;
  email: string;
  role: UserRole;
  clubId?: string;
  clubName?: string;
  clubLogo?: string;
  organizationId?: string;
}

/** Compat lecture : anciennes valeurs de rôle ('ADMIN'/'CLUB') → nouvelles. */
export function normalizeRole(role: string): UserRole {
  if (role === 'ADMIN') return 'FTF_ADMIN';
  if (role === 'CLUB') return 'CLUB_ADMIN';
  return role as UserRole;
}

/**
 * Vérification des identifiants : mot de passe, verrouillage, statut du compte.
 * Retourne l'utilisateur vérifié ou null (jamais la raison exacte — anti-énumération).
 * Extrait de NextAuth authorize() pour être testable unitairement.
 */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<VerifiedUser | null> {
  await connectDB();

  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+password')
    .populate('clubId');

  if (!user) {
    return null;
  }

  // Compte verrouillé après échecs répétés
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return null;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    // updateOne (pas de save()) : pas de re-validation des documents legacy
    const attempts = (user.failedLoginAttempts || 0) + 1;
    if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            failedLoginAttempts: 0,
            lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000),
          },
        }
      );
    } else {
      await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: attempts } });
    }
    return null;
  }

  // Statut du compte (SUSPENDED / DISABLED / INVITED ⇒ pas de connexion)
  if (user.status && user.status !== 'ACTIVE') {
    return null;
  }

  const role = normalizeRole(user.role);

  // Connexion réussie : reset des compteurs + auto-réparation du rôle legacy
  await User.updateOne(
    { _id: user._id },
    {
      $set: { failedLoginAttempts: 0, lastLoginAt: new Date(), role },
      $unset: { lockedUntil: 1 },
    }
  );

  // clubId est peuplé par .populate('clubId') — typé ObjectId par le schéma
  const club = user.clubId as unknown as
    | { _id: { toString(): string }; nom?: string; logo?: string }
    | null
    | undefined;

  return {
    id: user._id.toString(),
    email: user.email,
    role,
    clubId: club?._id?.toString(),
    clubName: club?.nom,
    clubLogo: club?.logo,
    organizationId: user.organizationId?.toString(),
  };
}
