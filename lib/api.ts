import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { auth } from './auth';

/** Erreur applicative avec statut HTTP et message public. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Session FTF_ADMIN obligatoire — lance ApiError(401/403) sinon. */
export async function requireAdmin() {
  const session = await auth();
  if (!session) {
    throw new ApiError(401, 'Non authentifié');
  }
  if (session.user.role !== 'FTF_ADMIN') {
    throw new ApiError(403, 'Accès réservé à l’administration FTF');
  }
  return session;
}

/**
 * Session CLUB_ADMIN obligatoire. Le clubId provient TOUJOURS de la session —
 * jamais d'un paramètre client.
 */
export async function requireClub() {
  const session = await auth();
  if (!session) {
    throw new ApiError(401, 'Non authentifié');
  }
  if (session.user.role !== 'CLUB_ADMIN' || !session.user.clubId) {
    throw new ApiError(403, 'Accès réservé aux administrateurs de club');
  }
  return { session, clubId: session.user.clubId };
}

/**
 * Réponse d'erreur sanitisée : ApiError/ZodError → message public,
 * tout le reste → 500 générique (détails uniquement en console serveur).
 */
export function apiError(error: unknown, context: string): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const message = error.issues
      .map((i) => (i.path.length ? `${i.path.join('.')} : ${i.message}` : i.message))
      .join(' · ');
    return NextResponse.json({ error: message }, { status: 400 });
  }
  console.error(`${context} error:`, error);
  return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
}

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Pagination avec plafond dur — aucune liste ne doit être illimitée.
 * Limites par défaut volontairement hautes tant que l'UI n'a pas de pagination
 * (DataTable en Phase 2) ; à resserrer ensuite.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  { defaultLimit = 200, maxLimit = 500 }: { defaultLimit?: number; maxLimit?: number } = {}
): Pagination {
  const rawPage = Number(searchParams.get('page') || 1);
  const rawLimit = Number(searchParams.get('limit') || defaultLimit);

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(Math.floor(rawLimit), maxLimit)
      : defaultLimit;

  return { page, limit, skip: (page - 1) * limit };
}
