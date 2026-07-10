import { z } from 'zod';

export const seasonCreateSchema = z.object({
  nom: z.string().min(3, 'Le nom de la saison doit contenir au moins 3 caractères').trim(),
  anneeDebut: z.number().int().min(2000).max(2100),
  anneeFin: z.number().int().min(2000).max(2100),
  dateDebut: z.string().or(z.date()).transform((val) => new Date(val)),
  dateFin: z.string().or(z.date()).transform((val) => new Date(val)),
  configuration: z.object({
    seuilCartonsJaunes: z.number().int().min(1).default(3),
    suspensionCartonRouge: z.number().int().min(1).default(1),
    suspensionStaff: z.number().int().min(1).default(1),
  }).optional(),
}).refine(data => data.anneeFin >= data.anneeDebut, {
  message: "L'année de fin doit être supérieure ou égale à l'année de début",
  path: ['anneeFin'],
}).refine(data => data.dateFin > data.dateDebut, {
  message: "La date de fin doit être supérieure à la date de début",
  path: ['dateFin'],
});

export const seasonUpdateSchema = z.object({
  nom: z.string().min(3, 'Le nom de la saison doit contenir au moins 3 caractères').trim().optional(),
  anneeDebut: z.number().int().min(2000).max(2100).optional(),
  anneeFin: z.number().int().min(2000).max(2100).optional(),
  dateDebut: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  dateFin: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  status: z.enum(['DRAFT', 'UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  configuration: z.object({
    seuilCartonsJaunes: z.number().int().min(1),
    suspensionCartonRouge: z.number().int().min(1),
    suspensionStaff: z.number().int().min(1),
  }).optional(),
});
