import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── 1. Eliminar TODOS los duplicados de "Cómo Reproducir Romero Sin Que Se Seque"
//       → Quedar con UN solo job activo (el más reciente ready_to_publish)
const { data: romeroJobs } = await s.from('video_jobs')
  .select('id, title, status, final_video_url, created_at')
  .ilike('title', '%Romero%')
  .order('created_at', { ascending: false });

console.log(`\nJobs de Romero encontrados: ${(romeroJobs||[]).length}`);

// Mantener el primero (más reciente ready_to_publish) y borrar el resto
const toKeep = (romeroJobs||[]).find(j => j.status === 'ready_to_publish') || romeroJobs?.[0];
const toDelete = (romeroJobs||[]).filter(j => j.id !== toKeep?.id && !j.final_video_url);

if (toDelete.length > 0) {
  const ids = toDelete.map(j => j.id);
  await s.from('video_jobs').delete().in('id', ids);
  console.log(`🗑️ Eliminados ${ids.length} duplicados de Romero.`);
}
if (toKeep) {
  console.log(`✅ Conservado: "${toKeep.title}" (${toKeep.id}) → status: ${toKeep.status}`);
}

// ── 2. Resetear los 4 videos con S1✓ que fallaron en S2 → ready_to_publish
//       (el checkpoint system del nuevo worker los reanuadará desde S2)
const { data: partialJobs } = await s.from('video_jobs')
  .select('id, title, status, scene_1_video_url, scene_2_video_url, scene_3_video_url')
  .eq('status', 'error')
  .not('scene_1_video_url', 'is', null)
  .is('final_video_url', null);

console.log(`\nJobs con checkpoint S1 en estado error: ${(partialJobs||[]).length}`);
for (const j of (partialJobs||[])) {
  await s.from('video_jobs').update({
    status: 'ready_to_publish',
    error_message: null
  }).eq('id', j.id);
  console.log(`✅ Reset con checkpoint S1✓: "${j.title}"`);
}

// ── 3. Ver estado final limpio
const { data: finalJobs } = await s.from('video_jobs')
  .select('id, title, status, final_video_url, scene_1_video_url, scene_2_video_url, scene_3_video_url, error_message, created_at')
  .order('created_at', { ascending: false })
  .limit(20);

console.log('\n=== COLA FINAL LIMPIA ===');
for (const j of (finalJobs || [])) {
  const scenes = [
    j.scene_1_video_url ? 'S1✓' : 'S1✗',
    j.scene_2_video_url ? 'S2✓' : 'S2✗',
    j.scene_3_video_url ? 'S3✓' : 'S3✗'
  ].join(' ');
  const final = j.final_video_url ? '🎬LISTO   ' : '⏳PENDIENTE';
  console.log(`[${j.status.padEnd(18)}] ${final} | ${scenes} | "${(j.title||'').slice(0,50)}"`);
  if (j.error_message) console.log(`   ERROR: ${(j.error_message||'').slice(0,100)}`);
}
