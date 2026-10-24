import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const ids = [
    'ba2fbda3-0990-49c4-bb61-fef007e675b3', // Albahaca
    'e1a33462-74ca-415f-a934-3aecd773c3d0', // Lechuga
    '302cb329-06f7-4914-a69d-27d3bc4faf51', // Jardín
    '341f797d-1bf9-497f-8907-c115e1df555c'  // Humus
  ];

  console.log('Reseteando Escena 1 corrupta (clip de romero) para los 4 videos afectados...');
  
  for (const id of ids) {
    const { data: job } = await s.from('video_jobs').select('title').eq('id', id).single();
    await s.from('video_jobs').update({
      scene_1_video_url: null,     // Borrar la escena 1 que tenía el romero
      final_video_url: null,       // Borrar el video final que empezaba con romero
      status: 'ready_to_publish',  // Para que el worker genere la Escena 1 real
      error_message: null
    }).eq('id', id);
    console.log(`✅ Reseteado para generar Escena 1 limpia: "${job.title}"`);
  }

  console.log('\n¡Listo! Las Escenas 2 y 3 reales se conservan intactas.');
}

main().catch(console.error);
