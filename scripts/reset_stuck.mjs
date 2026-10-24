import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Reset jobs atascados en 'rendering' sin final_video_url → volver a ready_to_publish
const { data: stuckJobs } = await s.from('video_jobs')
  .select('id, title, status, scene_1_video_url, scene_2_video_url, scene_3_video_url, final_video_url')
  .eq('status', 'rendering');

console.log(`\nJobs atascados en "rendering": ${(stuckJobs||[]).length}`);

for (const job of (stuckJobs || [])) {
  if (!job.final_video_url) {
    await s.from('video_jobs').update({
      status: 'ready_to_publish',
      error_message: 'Reset tras reinicio del servidor'
    }).eq('id', job.id);
    const scenes = [
      job.scene_1_video_url ? 'S1✓' : 'S1✗',
      job.scene_2_video_url ? 'S2✓' : 'S2✗',
      job.scene_3_video_url ? 'S3✓' : 'S3✗'
    ].join(' ');
    console.log(`✅ Reset "${job.title}" → ready_to_publish | Checkpoints: ${scenes}`);
  }
}

// Ver estado actual
const { data: allJobs } = await s.from('video_jobs')
  .select('id, title, status, final_video_url, scene_1_video_url, scene_2_video_url, scene_3_video_url, error_message, created_at')
  .order('created_at', { ascending: false })
  .limit(15);

console.log('\n=== ESTADO ACTUAL DE LA COLA ===');
for (const j of (allJobs || [])) {
  const scenes = [
    j.scene_1_video_url ? 'S1✓' : 'S1✗',
    j.scene_2_video_url ? 'S2✓' : 'S2✗',
    j.scene_3_video_url ? 'S3✓' : 'S3✗'
  ].join(' ');
  const final = j.final_video_url ? '🎬LISTO   ' : '⏳PENDIENTE';
  console.log(`[${j.status.padEnd(18)}] ${final} | ${scenes} | "${(j.title||'').slice(0,50)}"`);
  if (j.error_message) console.log(`   ERROR: ${(j.error_message||'').slice(0,100)}`);
}

// Ver cuentas Google
const { data: accounts } = await s.from('google_accounts')
  .select('alias, email, tier, status, daily_credits_used, daily_credits_total, last_used_at')
  .order('priority', { ascending: true });

console.log('\n=== CUENTAS GOOGLE ===');
for (const a of (accounts || [])) {
  const bar = `${a.daily_credits_used}/${a.daily_credits_total}`;
  console.log(`[${a.status.padEnd(10)}] ${a.alias.padEnd(18)} ${a.tier.padEnd(5)} | Créditos: ${bar}`);
}
