import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { execSync } from 'child_process';

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: job } = await s.from('video_jobs').select('*').eq('title', 'El Jardín que Despierta de Noche').single();
  console.log('Jardin:');
  console.log('S1:', job.scene_1_video_url);
  console.log('S2:', job.scene_2_video_url);
  console.log('S3:', job.scene_3_video_url);

  if (!fs.existsSync('temp_renders')) fs.mkdirSync('temp_renders');

  execSync(`ffmpeg -y -ss 00:00:02 -i "${job.scene_1_video_url}" -frames:v 1 temp_renders/frame_jardin_s1.jpg`);
  execSync(`ffmpeg -y -ss 00:00:02 -i "${job.scene_2_video_url}" -frames:v 1 temp_renders/frame_jardin_s2.jpg`);
  execSync(`ffmpeg -y -ss 00:00:02 -i "${job.scene_3_video_url}" -frames:v 1 temp_renders/frame_jardin_s3.jpg`);

  console.log('Frames creados correctamente en temp_renders/');
}

main().catch(console.error);
