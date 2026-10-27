import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Concatena video y audio estéreo de las escenas de Google Flow en formato vertical 9:16
 * @param {string[]} scenePaths - Array con las rutas de las escenas (.mp4)
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

    // Inspeccionar si cada archivo tiene pista de audio
    let filterParts = [];
    let concatPairs = '';

    scenePaths.forEach((p, index) => {
      const resolved = path.resolve(p);
      inputs.push('-i', resolved);

      let hasAudio = false;
      try {
        const out = execSync(`ffprobe -v error -select_streams a -show_entries stream=codec_name -of csv=p=0 "${resolved}"`, {
          encoding: 'utf8',
          timeout: 4000
        }).trim();
        if (out.length > 0) hasAudio = true;
      } catch (_) {}

      // Escalar video a 720x1280 24fps
      filterParts.push(`[${index}:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24[v${index}]`);

      if (hasAudio) {
        // Filtro de audio para limpiar armónicos metálicos y siseos sintéticos de IA
        // highpass=f=80 elimina ruidos sordos graves, lowpass=f=12500 suaviza siseos/artefactos metálicos agudos
        filterParts.push(`[${index}:a]highpass=f=80,lowpass=f=12500,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a${index}]`);
      } else {
        // Generar 8 segundos de silencio estéreo si el clip no trae audio
        filterParts.push(`aevalsrc=0:d=8.0:s=48000:c=stereo[a${index}]`);
      }
      concatPairs += `[v${index}][a${index}]`;
    });

    filterParts.push(`${concatPairs}concat=n=${n}:v=1:a=1[outv][outa]`);
    const filterComplex = filterParts.join(';');

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
