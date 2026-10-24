import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { execSync } from 'child_process';

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const ids = [
    'ba2fbda3-0990-49c4-bb61-fef007e675b3', // Albahaca
    'e1a33462-74ca-415f-a934-3aecd773c3d0', // Lechuga
    '341f797d-1bf9-497f-8907-c115e1df555c'  // Humus
  ];

  const { data: jobs } = await s.from('video_jobs').select('id, title, scene_2_video_url, scene_3_video_url').in('id', ids);

  for (const j of jobs) {
    const slug = j.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 15);
    console.log(`Extrayendo frames para ${j.title}...`);
    try {
      execSync(`ffmpeg -y -ss 00:00:02 -i "${j.scene_2_video_url}" -frames:v 1 "temp_renders/frame_${slug}_s2.jpg"`, { stdio: 'ignore' });
      execSync(`ffmpeg -y -ss 00:00:02 -i "${j.scene_3_video_url}" -frames:v 1 "temp_renders/frame_${slug}_s3.jpg"`, { stdio: 'ignore' });
      console.log(`  Frames S2 y S3 OK para ${j.title}`);
    } catch(e) {
      console.error(`  Error en ${j.title}:`, e.message);
    }
  }
}

main().catch(console.error);
