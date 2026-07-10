import fs from 'fs';
import path from 'path';

/** Erreur d'upload avec message public — les routes la traduisent en réponse 400. */
export class UploadError extends Error {}

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 Mo

interface ImageType {
  ext: string;
  mime: string;
}

/**
 * Détection par octets magiques — l'extension du nom de fichier et le
 * Content-Type fournis par le client ne sont jamais fiables.
 */
function detectImageType(buffer: Buffer): ImageType | null {
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

/**
 * Valide (taille + type réel) et enregistre une image sous public/uploads/<subDir>/.
 * Le nom de fichier et l'extension sont générés côté serveur.
 * Retourne le chemin public (/uploads/...). Lance UploadError si invalide.
 */
export async function saveImageUpload(file: File, subDir: string, prefix: string): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(`Fichier trop volumineux (maximum ${MAX_UPLOAD_BYTES / (1024 * 1024)} Mo)`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const type = detectImageType(buffer);
  if (!type) {
    throw new UploadError("Format d'image non supporté (PNG, JPEG ou WebP requis)");
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', subDir);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const fileName = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}.${type.ext}`;
  fs.writeFileSync(path.join(uploadDir, fileName), buffer);

  return `/uploads/${subDir}/${fileName}`;
}
