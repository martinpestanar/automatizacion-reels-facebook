import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Hay un "Tres Pisos" en error sin video + otro en ready_to_publish con video
// Eliminar el que está en error sin final_video_url
const { data: tresJobs } = await s.from('video_jobs')
  .select('id, title, status, final_video_url, created_at')
  .ilike('title', '%Tres Pisos%')
  .order('created_at', { ascending: false });

console.log('Tres Pisos jobs:', JSON.stringify(tresJobs, null, 2));

// Borrar los que tienen error y no tienen video
for (const j of (tresJobs || [])) {
  if (j.status === 'error' && !j.final_video_url) {
    await s.from('video_jobs').delete().eq('id', j.id);
    console.log(`🗑️ Eliminado duplicado error: ${j.id}`);
  }
}

console.log('✅ Limpieza completada.');
