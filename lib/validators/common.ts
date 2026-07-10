import { z } from 'zod';

/** ObjectId MongoDB (24 caractères hexadécimaux). */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Identifiant invalide');

/** Champ facultatif pouvant arriver vide ('') depuis un formulaire. */
export const optionalObjectId = z
  .union([objectIdSchema, z.literal('')])
  .optional()
  .transform((v) => (v ? v : undefined));
