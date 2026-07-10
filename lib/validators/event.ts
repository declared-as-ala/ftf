import { z } from 'zod';
import { objectIdSchema } from './common';

export const eventTypeSchema = z.enum([
  'But',
  'Carton Jaune',
  'Carton Rouge',
  'Remplacement',
  'Autre',
]);

export const eventCreateSchema = z
  .object({
    type: eventTypeSchema,
    minute: z.coerce.number().int().min(0).max(130),
    joueurId: z
      .union([objectIdSchema, z.literal('')])
      .optional()
      .transform((v) => (v ? v : undefined)),
    equipe: z
      .union([z.enum(['home', 'away']), z.literal('')])
      .optional()
      .transform((v) => (v ? v : undefined)),
    description: z.string().max(500).optional(),
  })
  // Seuls les buts peuvent rester sans équipe (assignation différée)
  .refine((d) => d.type === 'But' || !!d.equipe, {
    message: "L'équipe est obligatoire pour ce type d'événement",
    path: ['equipe'],
  });

/** PUT — modification partielle ; '' signifie « désassigner ». */
export const eventUpdateSchema = z.object({
  eventId: objectIdSchema,
  equipe: z.union([z.enum(['home', 'away']), z.literal('')]).optional(),
  joueurId: z.union([objectIdSchema, z.literal('')]).optional(),
  description: z.string().max(500).optional(),
});

export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
