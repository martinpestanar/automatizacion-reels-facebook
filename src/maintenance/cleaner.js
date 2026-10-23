import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Script de Purga y Mantenimiento Periódico:
 * 1. Limpia archivos pesados (.mp4 / fotos) de más de 48h de Supabase Storage.
 * 2. Ejecuta la purga de registros antiguos en la base de datos.
 * 3. Mantiene el bucket por debajo del límite gratuito de 1GB.
 */
export async function runAutoPurge() {
  console.log('🧹 [Mantenimiento] Iniciando limpieza periódica de Supabase...');

  try {
    // 1. Listar objetos en el bucket mrgreen-videos
    const { data: files, error: listError } = await supabase.storage
      .from('mrgreen-videos')
      .list('', { limit: 100, sortBy: { column: 'created_at', order: 'asc' } });

    if (listError) throw listError;

    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const filesToDelete = files
      ?.filter(f => new Date(f.created_at) < twoDaysAgo)
      ?.map(f => f.name) || [];

    if (filesToDelete.length > 0) {
      console.log(`🗑️ Eliminando ${filesToDelete.length} archivo(s) antiguo(s) del Storage...`);
      const { error: removeError } = await supabase.storage
        .from('mrgreen-videos')
        .remove(filesToDelete);

      if (removeError) console.error('Error al remover del storage:', removeError);
      else console.log('✅ Archivos de Storage liberados.');
    } else {
      console.log('✨ Storage limpio (no hay archivos de más de 48h).');
    }

    // 2. Ejecutar función SQL para purgar tablas
    const { data: dbPurge, error: dbError } = await supabase.rpc('purge_expired_jobs');
    if (dbError) throw dbError;

    console.log(`✅ Base de datos purgada. Trabajos antiguos archivados: ${dbPurge?.[0]?.deleted_jobs_count || 0}`);
  } catch (err) {
    console.error('Error durante la purga automática:', err);
  }
}

// Ejecutar si se llama por CLI: node src/maintenance/cleaner.js
if (process.argv[1]?.includes('cleaner.js')) {
  runAutoPurge();
}
