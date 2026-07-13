import { writeFileSync } from 'fs';

const CLUBS = [
  'EST', 'CA', 'ST', 'USM', 'ESS', 'CSS', 'ESZ', 'CAB', 'ASM', 'ESM', 'ASS', 'USBG', 'JSK', 'ASG', 'OB', 'JSO'
];

const TARGETS: Record<string, { w: number; d: number; l: number }> = {
  CA:   { w: 20, d: 6,  l: 4 },
  EST:  { w: 20, d: 3,  l: 7 },
  CSS:  { w: 20, d: 2,  l: 8 },
  ST:   { w: 12, d: 12, l: 6 },
  USM:  { w: 11, d: 12, l: 7 },
  ESZ:  { w: 10, d: 11, l: 9 },
  ESS:  { w: 11, d: 8,  l: 11 },
  ESM:  { w: 10, d: 10, l: 10 },
  JSO:  { w: 10, d: 6,  l: 14 },
  USBG: { w: 8,  d: 11, l: 11 },
  ASM:  { w: 8,  d: 11, l: 11 },
  CAB:  { w: 8,  d: 9,  l: 13 },
  OB:   { w: 7,  d: 11, l: 12 },
  JSK:  { w: 9,  d: 4,  l: 17 },
  ASS:  { w: 5,  d: 12, l: 13 },
  ASG:  { w: 4,  d: 6,  l: 20 }
};

function berger(count: number) {
  const teams = Array.from({ length: count }, (_, i) => i);
  const firstLeg: Array<Array<[number, number]>> = [];
  for (let round = 0; round < count - 1; round++) {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < count / 2; i++) {
      const a = teams[i]; const b = teams[count - 1 - i];
      pairs.push((round + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    firstLeg.push(pairs);
    teams.splice(1, 0, teams.pop()!);
  }
  return [...firstLeg, ...firstLeg.map(round => round.map(([h, a]) => [a, h] as [number, number]))];
}

const schedule = berger(CLUBS.length);
const matches: Array<{ home: string; away: string; outcome: number }> = [];

for (let r = 0; r < schedule.length; r++) {
  for (let game = 0; game < schedule[r].length; game++) {
    const [hi, ai] = schedule[r][game];
    matches.push({ home: CLUBS[hi], away: CLUBS[ai], outcome: 0 });
  }
}

function getRecords(matchList: typeof matches) {
  const records: Record<string, { w: number; d: number; l: number }> = {};
  for (const c of CLUBS) records[c] = { w: 0, d: 0, l: 0 };

  for (const m of matchList) {
    if (m.outcome === 1) {
      records[m.home].w++;
      records[m.away].l++;
    } else if (m.outcome === -1) {
      records[m.away].w++;
      records[m.home].l++;
    } else {
      records[m.home].d++;
      records[m.away].d++;
    }
  }
  return records;
}

function getError(records: ReturnType<typeof getRecords>) {
  let error = 0;
  for (const c of CLUBS) {
    const target = TARGETS[c];
    const rec = records[c];
    error += Math.abs(target.w - rec.w) + Math.abs(target.d - rec.d) + Math.abs(target.l - rec.l);
  }
  return error;
}

let solved = false;
const start = Date.now();

for (let restart = 0; restart < 500; restart++) {
  // Randomly initialize outcomes
  for (const m of matches) {
    m.outcome = [0, 1, -1][Math.floor(Math.random() * 3)];
  }

  let step = 0;
  let lastError = getError(getRecords(matches));

  while (step < 5000) {
    if (lastError === 0) {
      solved = true;
      break;
    }

    // Try a single random change
    const matchIdx = Math.floor(Math.random() * matches.length);
    const m = matches[matchIdx];
    const oldVal = m.outcome;
    const newVal = [0, 1, -1].filter(o => o !== oldVal)[Math.floor(Math.random() * 2)];

    m.outcome = newVal;
    const newRecords = getRecords(matches);
    const newError = getError(newRecords);

    if (newError < lastError) {
      lastError = newError;
    } else if (newError === lastError && Math.random() < 0.1) {
      // Small chance to accept equal error to drift/explore
      lastError = newError;
    } else {
      m.outcome = oldVal; // Revert
    }
    step++;
  }

  if (solved) {
    console.log(`Solved on restart ${restart} in ${Date.now() - start}ms!`);
    break;
  }
}

const finalRecords = getRecords(matches);
let finalError = getError(finalRecords);
if (finalError === 0) {
  console.log('SUCCESS! Perfect solution found.');
  writeFileSync('scratch/match-outcomes.json', JSON.stringify(matches, null, 2));
} else {
  console.log('FAILED to find perfect solution.');
}
