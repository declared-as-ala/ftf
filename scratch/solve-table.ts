const CLUBS = [
  'CA', 'EST', 'CSS', 'ST', 'USM', 'ESZ', 'ESS', 'ESM', 'JSO', 'USBG', 'ASM', 'CAB', 'OB', 'JSK', 'ASS', 'ASG'
];

const POINTS: Record<string, number> = {
  CA: 66, EST: 63, CSS: 62, ST: 48, USM: 45, ESZ: 41, ESS: 41, ESM: 40,
  JSO: 36, USBG: 35, ASM: 35, CAB: 33, OB: 32, JSK: 31, ASS: 27, ASG: 18
};

const REAL_TARGETS: Record<string, { w: number; d: number; l: number }> = {
  CA:   { w: 19, d: 9,  l: 2 },
  EST:  { w: 18, d: 9,  l: 3 },
  CSS:  { w: 18, d: 8,  l: 4 },
  ST:   { w: 12, d: 12, l: 6 },
  USM:  { w: 11, d: 12, l: 7 },
  ESZ:  { w: 10, d: 11, l: 9 }, // adjusted for 41 points
  ESS:  { w: 11, d: 8,  l: 11 },
  ESM:  { w: 9,  d: 13, l: 8 },
  JSO:  { w: 10, d: 6,  l: 14 },
  USBG: { w: 8,  d: 11, l: 11 },
  ASM:  { w: 8,  d: 11, l: 11 },
  CAB:  { w: 8,  d: 9,  l: 13 },
  OB:   { w: 7,  d: 11, l: 12 },
  JSK:  { w: 9,  d: 4,  l: 17 },
  ASS:  { w: 4,  d: 15, l: 11 },
  ASG:  { w: 4,  d: 6,  l: 20 }
};

// Find all valid (W, D, L) triplets per club
const validTriplets: Record<string, Array<{ w: number; d: number; l: number }>> = {};
for (const c of CLUBS) {
  validTriplets[c] = [];
  const pts = POINTS[c];
  for (let w = 0; w <= 30; w++) {
    const d = pts - 3 * w;
    if (d >= 0) {
      const l = 30 - w - d;
      if (l >= 0) {
        validTriplets[c].push({ w, d, l });
      }
    }
  }
}

function getError(assignment: Record<string, { w: number; d: number; l: number }>) {
  let err = 0;
  for (const c of CLUBS) {
    const target = REAL_TARGETS[c];
    const rec = assignment[c];
    err += Math.abs(rec.w - target.w) + Math.abs(rec.d - target.d) + Math.abs(rec.l - target.l);
  }
  return err;
}

let bestAssignment: Record<string, { w: number; d: number; l: number }> | null = null;
let bestError = Infinity;

for (let restart = 0; restart < 200000; restart++) {
  // Initialize with random valid triplets
  const assignment: Record<string, { w: number; d: number; l: number }> = {};
  for (const c of CLUBS) {
    const triplets = validTriplets[c];
    assignment[c] = triplets[Math.floor(Math.random() * triplets.length)];
  }

  let steps = 0;
  while (steps < 200) {
    let sumW = 0;
    let sumL = 0;
    for (const c of CLUBS) {
      sumW += assignment[c].w;
      sumL += assignment[c].l;
    }

    const diff = sumW - sumL;
    if (diff === 0) {
      const err = getError(assignment);
      if (err < bestError) {
        bestError = err;
        bestAssignment = JSON.parse(JSON.stringify(assignment));
      }
      break;
    }

    // Try to find a single club change that reduces |diff|
    let bestMove: { club: string; triplet: typeof validTriplets[string][0] } | null = null;
    let bestMoveScore = -Infinity; // Higher is better

    for (const c of CLUBS) {
      const triplets = validTriplets[c];
      const currentTriplet = assignment[c];
      for (const t of triplets) {
        if (t === currentTriplet) continue;
        const newW = sumW - currentTriplet.w + t.w;
        const newL = sumL - currentTriplet.l + t.l;
        const newDiff = newW - newL;
        if (Math.abs(newDiff) < Math.abs(diff)) {
          // Calculate error impact
          const target = REAL_TARGETS[c];
          const oldErr = Math.abs(currentTriplet.w - target.w) + Math.abs(currentTriplet.d - target.d) + Math.abs(currentTriplet.l - target.l);
          const newErr = Math.abs(t.w - target.w) + Math.abs(t.d - target.d) + Math.abs(t.l - target.l);
          const moveScore = -(newErr - oldErr); // lower newErr means higher score
          if (moveScore > bestMoveScore) {
            bestMoveScore = moveScore;
            bestMove = { club: c, triplet: t };
          }
        }
      }
    }

    if (bestMove) {
      assignment[bestMove.club] = bestMove.triplet;
    } else {
      break; // Stuck
    }
    steps++;
  }
}

if (bestAssignment) {
  console.log(`Success! Found optimal table with error = ${bestError}`);
  for (const c of CLUBS) {
    const rec = (bestAssignment as any)[c];
    console.log(`  ${c}: { w: ${rec.w}, d: ${rec.d}, l: ${rec.l} },`);
  }
} else {
  console.log('No valid combination found.');
}
