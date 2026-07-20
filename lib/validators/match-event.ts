import { z } from 'zod';
import { objectIdSchema } from './common';

export const matchEventTypeSchema = z.enum([
  'GOAL', 'OWN_GOAL', 'PENALTY_GOAL', 'YELLOW', 'SECOND_YELLOW_RED', 'DIRECT_RED',
]);

const common = z.object({
  clubId: objectIdSchema,
  playerId: objectIdSchema,
  type: matchEventTypeSchema,
  minute: z.coerce.number().int().min(0).max(130),
  stoppageMinute: z.coerce.number().int().min(0).max(30).optional(),
  assistPlayerId: objectIdSchema.optional().nullable(),
  cardReason: z.string().trim().max(200).optional(),
  reportReference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const matchEventCreateSchema = common.extend({
  clientMutationId: z.string().trim().min(8).max(100),
  confirmSuspendedPlayer: z.boolean().optional().default(false),
  anomalyNote: z.string().trim().min(10).max(1000).optional(),
}).superRefine((value, ctx) => {
  const goal = ['GOAL', 'OWN_GOAL', 'PENALTY_GOAL'].includes(value.type);
  if (!goal && value.assistPlayerId) ctx.addIssue({ code: 'custom', path: ['assistPlayerId'], message: 'Une passe décisive est réservée aux buts' });
  if (value.assistPlayerId === value.playerId) ctx.addIssue({ code: 'custom', path: ['assistPlayerId'], message: 'Le passeur doit être différent du buteur' });
});

export const matchEventUpdateSchema = common.partial().extend({
  expectedUpdatedAt: z.coerce.date().optional(),
});

export const matchEventCancelSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});

export type MatchEventCreateInput = z.infer<typeof matchEventCreateSchema>;
export type MatchEventUpdateInput = z.infer<typeof matchEventUpdateSchema>;
