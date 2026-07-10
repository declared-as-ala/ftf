import { z } from 'zod';
import { objectIdSchema } from './common';

export const competitionCreateSchema = z.object({
  nom: z.string().min(3, 'Le nom de la compétition doit contenir au moins 3 caractères').trim(),
  type: z.enum(['Championnat', 'Coupe', 'Super Coupe', 'Tournoi']),
  niveau: z.enum(['National', 'Régional', 'International']),
  saisonId: objectIdSchema,
  formatCompetition: z.enum(['Championnat', 'Élimination Directe', 'Groupes + Élimination']).default('Championnat'),
  reglementPoints: z.object({
    victoire: z.number().int().min(0).default(3),
    nul: z.number().int().min(0).default(1),
    defaite: z.number().int().min(0).default(0),
  }).default({ victoire: 3, nul: 1, defaite: 0 }),
  disciplinaryRuleSetId: objectIdSchema.optional(),
});

export const competitionUpdateSchema = z.object({
  nom: z.string().min(3, 'Le nom de la compétition doit contenir au moins 3 caractères').trim().optional(),
  type: z.enum(['Championnat', 'Coupe', 'Super Coupe', 'Tournoi']).optional(),
  niveau: z.enum(['National', 'Régional', 'International']).optional(),
  saisonId: objectIdSchema.optional(),
  formatCompetition: z.enum(['Championnat', 'Élimination Directe', 'Groupes + Élimination']).optional(),
  reglementPoints: z.object({
    victoire: z.number().int().min(0),
    nul: z.number().int().min(0),
    defaite: z.number().int().min(0),
  }).optional(),
  active: z.boolean().optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  isOfficial: z.boolean().optional(),
  tieBreakers: z.array(z.enum(['POINTS', 'HEAD_TO_HEAD', 'GOAL_DIFFERENCE', 'GOALS_SCORED', 'FAIR_PLAY'])).optional(),
  disciplinaryRuleSetId: objectIdSchema.optional(),
});

export const competitionClubsSchema = z.object({
  clubIds: z.array(objectIdSchema),
});
