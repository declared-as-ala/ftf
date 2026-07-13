import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import path from 'path';

const CLUB_LOGOS: Record<string, string> = {
  EST: 'https://upload.wikimedia.org/wikipedia/fr/5/5b/Esp%C3%A9rance_Sportive_de_Tunis.svg',
  CA: 'https://upload.wikimedia.org/wikipedia/fr/0/0b/Club_africain_%28logo%29.svg',
  ST: 'https://upload.wikimedia.org/wikipedia/fr/2/2f/Stade_tunisien_%28logo%29.svg',
  USM: 'https://upload.wikimedia.org/wikipedia/fr/8/87/Union_sportive_monastirienne.svg',
  ESS: 'https://upload.wikimedia.org/wikipedia/fr/7/70/%C3%89toile_sportive_du_Sahel_%28logo%29.svg',
  CSS: 'https://upload.wikimedia.org/wikipedia/fr/b/bd/Club_sportif_sfaxien.svg',
  ESZ: 'https://upload.wikimedia.org/wikipedia/fr/b/b2/Esp%C3%A9rance_sportive_de_Zarzis_%28logo%29.svg',
  CAB: 'https://upload.wikimedia.org/wikipedia/fr/7/71/Club_athl%C3%A9tique_bizertin.svg',
  ASM: 'https://upload.wikimedia.org/wikipedia/fr/0/0a/Avenir_sportif_de_La_Marsa.svg',
  ESM: 'https://upload.wikimedia.org/wikipedia/fr/4/4c/%C3%89toile_sportive_de_M%C3%A9tlaoui_%28logo%29.svg',
  ASS: 'https://upload.wikimedia.org/wikipedia/fr/8/8c/Avenir_sportif_de_Soliman.svg',
  USBG: 'https://upload.wikimedia.org/wikipedia/fr/3/30/Union_sportive_de_Ben_Guerdane.svg',
  JSK: 'https://upload.wikimedia.org/wikipedia/fr/2/25/Jeunesse_sportive_kairouanaise.svg',
  ASG: 'https://upload.wikimedia.org/wikipedia/fr/7/7c/Avenir_sportif_de_Gab%C3%A8s_%28logo%29.svg',
  OB: 'https://upload.wikimedia.org/wikipedia/fr/c/c5/Olympique_de_B%C3%A9ja.svg',
  JSO: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Logo_Jeunesse_Sportive_El_Omrane.png'
};

function getWikipediaUrl(fileName: string): string {
  // Wikipedia uses underscores instead of spaces, and URL-decoded name for hashing
  const decodedName = decodeURIComponent(fileName).replace(/ /g, '_');
  const hash = crypto.createHash('md5').update(decodedName).digest('hex');
  const a = hash[0];
  const ab = hash.substring(0, 2);
  return `https://upload.wikimedia.org/wikipedia/commons/${a}/${ab}/${fileName.replace(/ /g, '_')}`;
}

async function downloadFile(url: string, dest: string): Promise<boolean> {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(dest);
    https.get(url, {
      headers: { 'User-Agent': 'FTFPlatformBot/1.0 (admin@ftf.tn; pair-programming-agent)' }
    }, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(true);
        });
      } else {
        console.error(`HTTP Error for ${url}: status code ${response.statusCode}`);
        file.close();
        fs.unlink(dest, () => {});
        resolve(false);
      }
    }).on('error', (err) => {
      console.error(`Network Error for ${url}:`, err.message);
      file.close();
      fs.unlink(dest, () => {});
      resolve(false);
    });
  });
}

async function test() {
  console.log('Testing logo downloads...');
  const testDir = path.join(process.cwd(), 'scratch', 'test_logos');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  for (const [code, url] of Object.entries(CLUB_LOGOS)) {
    const ext = url.endsWith('.png') ? 'png' : 'svg';
    const dest = path.join(testDir, `${code}.${ext}`);
    console.log(`Downloading ${code} from ${url} ...`);
    const success = await downloadFile(url, dest);
    console.log(`Result for ${code}: ${success ? 'SUCCESS' : 'FAILED'}`);
  }
}

test();
