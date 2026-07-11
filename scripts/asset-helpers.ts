import fs from 'fs';
import path from 'path';

/**
 * Génération d'assets SVG déterministes pour le seed :
 *  - blasons de clubs (écusson bicolore + code)
 *  - avatars joueurs (initiales aux couleurs du club)
 * Aucune dépendance réseau — les fichiers sont écrits sous public/uploads/.
 */

const COLOR_HEX: Record<string, string> = {
  Rouge: '#c8102e',
  Jaune: '#f2b705',
  Blanc: '#f5f5f2',
  Noir: '#181a1f',
  Bleu: '#1857a4',
  Vert: '#0f7b3e',
};

export function colorHex(name?: string): string {
  return (name && COLOR_HEX[name]) || '#33415c';
}

/** Couleur de texte lisible sur un fond donné. */
function textOn(bg: string): string {
  return bg === COLOR_HEX.Blanc || bg === COLOR_HEX.Jaune ? '#101828' : '#ffffff';
}

const SHIELD_PATH =
  'M60 6 L112 24 V72 C112 106 91 126 60 134 C29 126 8 106 8 72 V24 Z';

export function clubLogoSvg(code: string, colors: string[]): string {
  const c1 = colorHex(colors[0]);
  const c2 = colorHex(colors[1] ?? colors[0]);
  const band = '#101828';
  const fontSize = code.length >= 4 ? 21 : code.length === 3 ? 26 : 30;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140">
  <defs>
    <clipPath id="shield"><path d="${SHIELD_PATH}"/></clipPath>
  </defs>
  <path d="${SHIELD_PATH}" fill="${c1}"/>
  <g clip-path="url(#shield)">
    <rect x="60" y="0" width="60" height="140" fill="${c2}"/>
    <rect x="0" y="76" width="120" height="30" fill="${band}"/>
    <circle cx="60" cy="44" r="17" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="3"/>
    <path d="M60 27 v34 M43 44 h34" stroke="rgba(255,255,255,0.85)" stroke-width="3"/>
  </g>
  <text x="60" y="98" text-anchor="middle" dominant-baseline="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="bold"
        font-size="${fontSize}" fill="#ffffff" letter-spacing="1">${code}</text>
  <path d="${SHIELD_PATH}" fill="none" stroke="rgba(16,24,40,0.9)" stroke-width="3"/>
  <path d="M60 12 L106 28 V71 C106 101 88 119 60 127 C32 119 14 101 14 71 V28 Z"
        fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
</svg>`;
}

export function playerAvatarSvg(initials: string, colors: string[]): string {
  const c1 = colorHex(colors[0]);
  const c2 = colorHex(colors[1] ?? colors[0]);
  const text = textOn(c1);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <circle cx="48" cy="48" r="46" fill="${c1}"/>
  <circle cx="48" cy="48" r="42" fill="none" stroke="${c2}" stroke-width="4"/>
  <text x="48" y="51" text-anchor="middle" dominant-baseline="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="bold"
        font-size="32" fill="${text}" letter-spacing="1">${initials}</text>
</svg>`;
}

/** Écrit un SVG sous public/uploads/<subDir>/ et retourne son chemin public. */
export function writeSvgAsset(subDir: string, fileName: string, svg: string): string {
  const dir = path.join(process.cwd(), 'public', 'uploads', subDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), svg, 'utf8');
  return `/uploads/${subDir}/${fileName}`;
}
