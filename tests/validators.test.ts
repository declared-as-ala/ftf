import { describe, it, expect } from 'vitest';
import { matchCreateSchema, matchResultPatchSchema } from '../lib/validators/match';
import { eventCreateSchema, eventUpdateSchema } from '../lib/validators/event';
import { objectIdSchema } from '../lib/validators/common';

const oid = () => '6540deadbeef1234567890ab';
const oid2 = () => '6540deadbeef1234567890ac';

const validMatch = () => ({
  saisonId: oid(),
  competitionId: oid(),
  journee: 3,
  homeClubId: oid(),
  awayClubId: oid2(),
  date: '2026-07-12T18:00:00.000Z',
  stade: 'Stade Olympique de Radès',
});

describe('objectIdSchema', () => {
  it('accepte un ObjectId valide', () => {
    expect(objectIdSchema.safeParse(oid()).success).toBe(true);
  });
  it('rejette un id invalide', () => {
    expect(objectIdSchema.safeParse('abc').success).toBe(false);
    expect(objectIdSchema.safeParse('../../etc/passwd').success).toBe(false);
  });
});

describe('matchCreateSchema', () => {
  it('accepte un match valide avec défauts', () => {
    const parsed = matchCreateSchema.parse(validMatch());
    expect(parsed.scoreHome).toBe(0);
    expect(parsed.statut).toBe('Programmé');
    expect(parsed.date).toBeInstanceOf(Date);
  });

  it('rejette home === away', () => {
    const res = matchCreateSchema.safeParse({ ...validMatch(), awayClubId: oid() });
    expect(res.success).toBe(false);
  });

  it('rejette une journée invalide', () => {
    expect(matchCreateSchema.safeParse({ ...validMatch(), journee: 0 }).success).toBe(false);
    expect(matchCreateSchema.safeParse({ ...validMatch(), journee: 999 }).success).toBe(false);
  });

  it('rejette un statut inconnu (protection mass-assignment)', () => {
    expect(matchCreateSchema.safeParse({ ...validMatch(), statut: 'HACKED' }).success).toBe(false);
  });

  it('rejette une date invalide', () => {
    expect(matchCreateSchema.safeParse({ ...validMatch(), date: 'pas-une-date' }).success).toBe(false);
  });

  it("transforme arbitrePrincipalId vide ('') en undefined", () => {
    const parsed = matchCreateSchema.parse({ ...validMatch(), arbitrePrincipalId: '' });
    expect(parsed.arbitrePrincipalId).toBeUndefined();
  });
});

describe('matchResultPatchSchema', () => {
  it('accepte une mise à jour partielle', () => {
    const parsed = matchResultPatchSchema.parse({ scoreHome: 2 });
    expect(parsed.scoreHome).toBe(2);
    expect(parsed.scoreAway).toBeUndefined();
  });
  it('rejette un score négatif', () => {
    expect(matchResultPatchSchema.safeParse({ scoreHome: -1 }).success).toBe(false);
  });
});

describe('eventCreateSchema', () => {
  it('accepte un but sans équipe (assignation différée)', () => {
    const parsed = eventCreateSchema.parse({ type: 'But', minute: 42 });
    expect(parsed.equipe).toBeUndefined();
  });

  it("exige l'équipe pour un carton", () => {
    expect(eventCreateSchema.safeParse({ type: 'Carton Jaune', minute: 42 }).success).toBe(false);
    expect(
      eventCreateSchema.safeParse({ type: 'Carton Jaune', minute: 42, equipe: 'home' }).success
    ).toBe(true);
  });

  it('rejette une minute hors bornes', () => {
    expect(eventCreateSchema.safeParse({ type: 'But', minute: 500 }).success).toBe(false);
  });

  it('rejette un type inconnu', () => {
    expect(eventCreateSchema.safeParse({ type: 'VAR', minute: 10 }).success).toBe(false);
  });
});

describe('eventUpdateSchema', () => {
  it("accepte '' pour désassigner", () => {
    const parsed = eventUpdateSchema.parse({ eventId: oid(), equipe: '', joueurId: '' });
    expect(parsed.equipe).toBe('');
  });
  it('exige un eventId valide', () => {
    expect(eventUpdateSchema.safeParse({ eventId: 'nope' }).success).toBe(false);
  });
});
