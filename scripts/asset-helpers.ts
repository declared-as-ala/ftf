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

  // Render a custom high-fidelity background pattern depending on the club's code
  let patternSvg = '';
  switch (code) {
    case 'EST': // Espérance Tunis: Red and Yellow vertical stripes
      patternSvg = `
        <rect x="0" y="0" width="24" height="140" fill="${c1}"/>
        <rect x="24" y="0" width="24" height="140" fill="${c2}"/>
        <rect x="48" y="0" width="24" height="140" fill="${c1}"/>
        <rect x="72" y="0" width="24" height="140" fill="${c2}"/>
        <rect x="96" y="0" width="24" height="140" fill="${c1}"/>
      `;
      break;
    case 'CSS': // CS Sfaxien: Black and White vertical stripes
      patternSvg = `
        <rect x="0" y="0" width="24" height="140" fill="${c1}"/>
        <rect x="24" y="0" width="24" height="140" fill="${c2}"/>
        <rect x="48" y="0" width="24" height="140" fill="${c1}"/>
        <rect x="72" y="0" width="24" height="140" fill="${c2}"/>
        <rect x="96" y="0" width="24" height="140" fill="${c1}"/>
      `;
      break;
    case 'ESS': // Étoile du Sahel: Red background with a big white 5-pointed star
      patternSvg = `
        <rect x="0" y="0" width="120" height="140" fill="${c1}"/>
        <polygon points="60,20 64,36 80,36 67,46 72,62 60,52 48,62 53,46 40,36 56,36" fill="${c2}"/>
      `;
      break;
    case 'CA': // Club Africain: Red and White circular target style
      patternSvg = `
        <rect x="0" y="0" width="120" height="140" fill="${c1}"/>
        <circle cx="60" cy="50" r="40" fill="${c2}"/>
        <circle cx="60" cy="50" r="32" fill="${c1}"/>
        <circle cx="60" cy="50" r="24" fill="${c2}"/>
        <circle cx="60" cy="50" r="16" fill="${c1}"/>
      `;
      break;
    case 'ST': // Stade Tunisien: Red and Green halves with white sash
      patternSvg = `
        <rect x="0" y="0" width="60" height="140" fill="${c1}"/>
        <rect x="60" y="0" width="60" height="140" fill="${c2}"/>
        <polygon points="0,0 120,120 120,140 0,20" fill="#f5f5f2"/>
      `;
      break;
    case 'USM': // US Monastir: Blue and White vertical halves with a circle motif
      patternSvg = `
        <rect x="0" y="0" width="60" height="140" fill="${c1}"/>
        <rect x="60" y="0" width="60" height="140" fill="${c2}"/>
        <circle cx="60" cy="50" r="25" fill="none" stroke="${c2}" stroke-width="4"/>
      `;
      break;
    case 'CAB': // CA Bizertin: Yellow and Black quarters
      patternSvg = `
        <rect x="0" y="0" width="60" height="70" fill="${c1}"/>
        <rect x="60" y="0" width="60" height="70" fill="${c2}"/>
        <rect x="0" y="70" width="60" height="70" fill="${c2}"/>
        <rect x="60" y="70" width="60" height="70" fill="${c1}"/>
      `;
      break;
    case 'ASM': // AS Marsa: Green and Yellow vertical halves
      patternSvg = `
        <rect x="0" y="0" width="60" height="140" fill="${c1}"/>
        <rect x="60" y="0" width="60" height="140" fill="${c2}"/>
      `;
      break;
    case 'ESZ': // ES Zarzis: Red and Yellow horizontal stripes
      patternSvg = `
        <rect x="0" y="0" width="120" height="35" fill="${c1}"/>
        <rect x="0" y="35" width="120" height="35" fill="${c2}"/>
        <rect x="0" y="70" width="120" height="35" fill="${c1}"/>
        <rect x="0" y="105" width="120" height="35" fill="${c2}"/>
      `;
      break;
    case 'USBG': // US Ben Guerdane: Yellow and Black horizontal halves
      patternSvg = `
        <rect x="0" y="0" width="120" height="70" fill="${c1}"/>
        <rect x="0" y="70" width="120" height="70" fill="${c2}"/>
      `;
      break;
    case 'JSK': // JS Kairouanaise: Green and White diagonal stripes
      patternSvg = `
        <rect x="0" y="0" width="120" height="140" fill="${c1}"/>
        <polygon points="0,0 40,0 120,80 120,120" fill="${c2}"/>
        <polygon points="0,60 0,100 80,140 120,140" fill="${c2}"/>
      `;
      break;
    case 'ASG': // AS Gabès: Red and Black halves with gold star
      patternSvg = `
        <rect x="0" y="0" width="60" height="140" fill="${c1}"/>
        <rect x="60" y="0" width="60" height="140" fill="${c2}"/>
        <polygon points="60,35 62,41 68,41 63,45 65,51 60,47 55,51 57,45 52,41 58,41" fill="#f5f5f2"/>
      `;
      break;
    case 'OB': // Olympique Béja: Red and White quarters
      patternSvg = `
        <rect x="0" y="0" width="60" height="70" fill="${c1}"/>
        <rect x="60" y="0" width="60" height="70" fill="${c2}"/>
        <rect x="0" y="70" width="60" height="70" fill="${c2}"/>
        <rect x="60" y="70" width="60" height="70" fill="${c1}"/>
      `;
      break;
    case 'JSO': // JS El Omrane: Blue and White halves with crescent
      patternSvg = `
        <rect x="0" y="0" width="60" height="140" fill="${c1}"/>
        <rect x="60" y="0" width="60" height="140" fill="${c2}"/>
        <path d="M 60 35 A 15 15 0 0 0 60 65 A 12 12 0 0 1 65 37" fill="#f5f5f2"/>
      `;
      break;
    default: // Standard bicolour halves for others
      patternSvg = `
        <rect x="0" y="0" width="60" height="140" fill="${c1}"/>
        <rect x="60" y="0" width="60" height="140" fill="${c2}"/>
      `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140">
  <defs>
    <clipPath id="shield"><path d="${SHIELD_PATH}"/></clipPath>
  </defs>
  <path d="${SHIELD_PATH}" fill="${c1}"/>
  <g clip-path="url(#shield)">
    ${patternSvg}
    <rect x="0" y="80" width="120" height="26" fill="${band}"/>
  </g>
  <text x="60" y="93" text-anchor="middle" dominant-baseline="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="bold"
        font-size="${fontSize}" fill="#ffffff" letter-spacing="1">${code}</text>
  <path d="${SHIELD_PATH}" fill="none" stroke="rgba(16,24,40,0.9)" stroke-width="3"/>
  <path d="M60 12 L106 28 V71 C106 101 88 119 60 127 C32 119 14 101 14 71 V28 Z"
        fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
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

/** Écrit un SVG sous public/uploads/<subDir>/ et retourne son chemin public ou l'URL Vercel Blob. */
export async function writeSvgAsset(subDir: string, fileName: string, svg: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = await import('@vercel/blob');
      const blobResult = await put(`${subDir}/${fileName}`, Buffer.from(svg, 'utf8'), {
        access: 'public',
        contentType: 'image/svg+xml',
      });
      return blobResult.url;
    } catch (e) {
      console.error(`Erreur d'upload Vercel Blob pour SVG ${fileName}:`, e);
    }
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', subDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), svg, 'utf8');
  return `/uploads/${subDir}/${fileName}`;
}

/** Transfère un fichier local existant sous public/ vers Vercel Blob si configuré. */
export async function uploadLocalFileToBlob(localPath: string, subDir: string, fileName: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const absolutePath = path.join(process.cwd(), 'public', localPath);
      if (fs.existsSync(absolutePath)) {
        const { put } = await import('@vercel/blob');
        const buffer = fs.readFileSync(absolutePath);
        const blobResult = await put(`${subDir}/${fileName}`, buffer, {
          access: 'public',
          contentType: 'image/png',
        });
        return blobResult.url;
      }
    } catch (e) {
      console.error(`Erreur d'upload Vercel Blob pour ${localPath}:`, e);
    }
  }
  return localPath;
}
