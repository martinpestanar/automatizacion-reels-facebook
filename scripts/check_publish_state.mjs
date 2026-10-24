import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Verificar columnas disponibles en video_jobs
const { data, error } = await s.from('video_jobs').select('*').limit(1).single();
console.log('Columnas disponibles:', Object.keys(data || {}).join(', '));

// Ver cuántos videos se publicaron hoy
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);

const { data: publishedToday } = await s.from('video_jobs')
  .select('id, title, published_at, status')
  .eq('status', 'published')
  .gte('published_at', todayStart.toISOString());

console.log(`\nPublicados hoy (${todayStart.toLocaleDateString()}): ${(publishedToday||[]).length}`);
for (const v of (publishedToday || [])) {
  console.log(`  - "${v.title}" a las ${new Date(v.published_at).toLocaleTimeString()}`);
}

// Ver videos listos para publicar
const { data: readyVideos } = await s.from('video_jobs')
  .select('id, title, status, final_video_url, copy_text, image_url, image_copy_text, brand_id')
  .eq('status', 'ready_to_publish')
  .not('final_video_url', 'is', null)
  .order('created_at', { ascending: true });

console.log(`\nVideos listos para publicar: ${(readyVideos||[]).length}`);
for (const v of (readyVideos || [])) {
  console.log(`  - "${v.title}"`);
}
