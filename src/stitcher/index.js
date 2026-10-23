import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Concatena video y audio estéreo de las 3 escenas de Google Flow en formato vertical 9:16
 * @param {string[]} scenePaths - Array con las rutas de las 3 escenas (.mp4)
 * @param {string} outputPath - Ruta del archivo resultante (.mp4)
 * @returns {Promise<string>} - Ruta final del video
 */
export async function stitchScenes(scenePaths, outputPath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const n = scenePaths.length;
    const inputs = [];
    let filterStreams = '';

    scenePaths.forEach((p, index) => {
      inputs.push('-i', path.resolve(p));
      filterStreams += `[${index}:v][${index}:a]`;
    });

    // Filtro para unir VIDEO y AUDIO alternados por cada segmento [0:v][0:a][1:v][1:a]...
    const filterComplex = `${filterStreams}concat=n=${n}:v=1:a=1[outv][outa]`;

    const args = [
      ...inputs,
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-map', '[outa]',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-y',
      outputPath
    ];

    const proc = spawn('ffmpeg', args);

    let errorLog = '';
    proc.stderr.on('data', (data) => {
      errorLog += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`FFmpeg error (code ${code}): ${errorLog.slice(-500)}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}
