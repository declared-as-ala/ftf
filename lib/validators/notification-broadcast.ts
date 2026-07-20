import { z } from 'zod';

export const NotificationBroadcastSchema = z.object({
  subject: z
    .string()
    .min(3, 'Le sujet doit contenir au moins 3 caractères')
    .max(200, 'Le sujet ne peut dépasser 200 caractères')
    .trim(),
  body: z
    .string()
    .min(10, 'Le message doit contenir au moins 10 caractères')
    .max(5000, 'Le message ne peut dépasser 5000 caractères')
    .trim(),
  target: z.enum(['ALL', 'SPECIFIC']),
  targetClubIds: z.array(z.string()).optional().default([]),
  idempotencyKey: z.string().optional(),
}).refine(
  (d) => d.target === 'ALL' || (d.targetClubIds && d.targetClubIds.length > 0),
  { message: 'Vous devez sélectionner au moins un club pour un envoi ciblé', path: ['targetClubIds'] }
);

export type NotificationBroadcastInput = z.infer<typeof NotificationBroadcastSchema>;
