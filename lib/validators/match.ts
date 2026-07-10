import { z } from 'zod';
import { objectIdSchema, optionalObjectId } from './common';

export const matchStatutSchema = z.enum([
  'Programmé',
  'En Cours',
  'Brouillon',
  'À Valider',     // legacy alias — still accepted inbound
  'Terminé',
  'Reporté',
  'Annulé',
  'Abandonné',
  'Forfait',
  'Replay Ordonné',
]);

const matchBaseSchema = z.object({
  saisonId: objectIdSchema,
  competitionId: objectIdSchema,
  journee: z.coerce.number().int().min(1).max(200),
  homeClubId: objectIdSchema,
  awayClubId: objectIdSchema,
  date: z.coerce.date(),
  stade: z.string().trim().min(1, 'Stade requis').max(200),
  scoreHome: z.coerce.number().int().min(0).max(99).default(0),
  scoreAway: z.coerce.number().int().min(0).max(99).default(0),
  statut: matchStatutSchema.default('Programmé'),
  arbitrePrincipalId: optionalObjectId,
  notes: z.string().max(2000).optional(),
  spectateurs: z.coerce.number().int().min(0).optional(),
  public: z.boolean().optional().default(false),
});

const differentClubs = (d: { homeClubId: string; awayClubId: string }) =>
  d.homeClubId !== d.awayClubId;
const differentClubsMessage = {
  message: 'Les clubs domicile et extérieur doivent être différents',
  path: ['awayClubId'],
};

export const matchCreateSchema = matchBaseSchema.refine(differentClubs, differentClubsMessage);

export const matchUpdateSchema = matchBaseSchema
  .extend({ id: objectIdSchema })
  .refine(differentClubs, differentClubsMessage);

/** PUT /api/admin/matchs/[id] — mise à jour partielle du résultat. */
export const matchResultPatchSchema = z.object({
  scoreHome: z.coerce.number().int().min(0).max(99).optional(),
  scoreAway: z.coerce.number().int().min(0).max(99).optional(),
  statut: matchStatutSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export type MatchCreateInput = z.infer<typeof matchCreateSchema>;
export type MatchUpdateInput = z.infer<typeof matchUpdateSchema>;
