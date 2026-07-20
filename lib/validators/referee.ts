import { z } from 'zod';
import { objectIdSchema } from './common';

export const refereeCategorieSchema = z.enum([
  'Élite',
  'Première Division',
  'Deuxième Division',
  'Régional',
  'ELITE',
  'NATIONAL',
  'REGIONAL',
]);

export const refereeStatusSchema = z.enum([
  'ACTIVE',
  'UNAVAILABLE',
  'SUSPENDED',
  'INACTIVE',
  'ARCHIVED',
]);

const refereeBaseSchema = z.object({
  nom: z.string().trim().min(1, 'Nom requis').max(100),
  prenom: z.string().trim().min(1, 'Prénom requis').max(100),
  categorie: refereeCategorieSchema,
  dateNaissance: z.coerce.date(),
  nationalite: z.string().trim().min(1, 'Nationalité requise').max(100),
  email: z.string().trim().email('Format email invalide').optional().or(z.literal('')),
  telephone: z.string().trim().max(30).optional().or(z.literal('')),
  ville: z.string().trim().min(1, 'Ville requise').max(100),
  status: refereeStatusSchema.default('ACTIVE'),
  licence: z.string().trim().max(50).optional().or(z.literal('')),
  region: z.string().trim().max(100).optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const refereeCreateSchema = refereeBaseSchema;
export const refereeUpdateSchema = refereeBaseSchema.extend({
  id: objectIdSchema,
});

export type RefereeCreateInput = z.infer<typeof refereeCreateSchema>;
export type RefereeUpdateInput = z.infer<typeof refereeUpdateSchema>;
