import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateNanoBananaInfographic } from './flow_image_generator.js';

dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function regenerateAll() {
  const { data: jobs, error } = await supabase
    .from('video_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(6);

  if (error || !jobs) {
    console.error('Error fetching jobs:', error);
    return;
  }

  // Filtrar los que tienen fotos planas de ffmpeg (satelite_vertical) o están sin imagen
  const targets = jobs.filter(j => !j.image_url || j.image_url.includes('satelite_vertical'));
  console.log(`Encontrados ${targets.length} trabajos para regenerar con Nano Banana 2.1`);

  for (const job of targets) {
    console.log(`\n========================================`);
    console.log(`🚀 Regenerando infografía para: ${job.title}...`);
    try {
      const url = await generateNanoBananaInfographic(job);
      console.log(`✅ Infografía completada para ${job.title}: ${url}`);
    } catch (e) {
      console.error(`❌ Error con ${job.title}:`, e.message);
    }
  }
  console.log('\n✨ Proceso de regeneración finalizado.');
}

regenerateAll();
