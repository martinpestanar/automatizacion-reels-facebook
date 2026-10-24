import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getConfig() {
  try {
    const { data } = await supabase
      .from('image_formats')
      .select('description')
      .eq('code', 'flow_settings_config')
      .single();
    if (data && data.description) {
      return JSON.parse(data.description);
    }
  } catch (e) {
    console.warn('[Autofill] Advertencia cargando configuración:', e.message);
  }
  return {
    automation_enabled: true,
    daily_target_videos: 5,
    min_queue_buffer: 3,
    publish_to_stories: true
  };
}

// ─── AUTO-PUBLICACIÓN: Dispara los webhooks de n8n para Video y para Historia ───────────────
async function autoPublishVideo(job, config) {
  try {
    // Bloquear ANTES de disparar webhook para evitar doble publicación
    await supabase.from('video_jobs').update({
      status: 'published',
      published_at: new Date().toISOString()
    }).eq('id', job.id).eq('status', 'ready_to_publish'); // condición extra de seguridad

    console.log(`📤 [AutoPublish] Disparando n8n webhook de REEL para: "${job.title}"`);

    const reelPayload = {
      id: job.id,
      publish_target: 'reel',
      final_video_url: job.final_video_url,
      copy_text: job.copy_text || '',
      topic: job.topic || job.pilar,
      title: job.title,
      aspect_ratio: '9:16',
      brand_id: job.brand_id || '06a68062-00c0-413d-b41f-b2229b9d52da',
      image_prompt: job.image_prompt || null,
      image_url: job.image_url || null,
      image_copy_text: job.image_copy_text || null
    };

    const resReel = await fetch('https://n8n.koratflow.agency/webhook/publish-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reelPayload)
    });

    console.log(`✅ [AutoPublish] Webhook REEL respondió: ${resReel.status} para "${job.title}"`);

    // Publicar también en Historias de Facebook si está habilitado en la configuración
    if (config.publish_to_stories !== false) {
      console.log(`📱 [AutoPublish] Esperando 3s antes de publicar Historia en Facebook...`);
      await new Promise(r => setTimeout(r, 3000));

      console.log(`📱 [AutoPublish] Disparando n8n webhook de HISTORIA para: "${job.title}"`);
      const storyPayload = {
        id: job.id,
        publish_target: 'story',
        final_video_url: job.final_video_url,
        copy_text: job.copy_text || '',
        topic: job.topic || job.pilar,
        title: job.title,
        aspect_ratio: '9:16',
        brand_id: job.brand_id || '06a68062-00c0-413d-b41f-b2229b9d52da',
        image_prompt: job.image_prompt || null,
        image_url: job.image_url || null,
        image_copy_text: job.image_copy_text || null
      };

      try {
        const resStory = await fetch('https://n8n.koratflow.agency/webhook/publish-now', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(storyPayload)
        });
        console.log(`🎉 [AutoPublish] Webhook HISTORIA respondió: ${resStory.status} para "${job.title}"`);
      } catch (storyErr) {
        console.warn(`⚠️ [AutoPublish] Error despachando Historia a n8n:`, storyErr.message);
      }
    }

    return true;
  } catch (err) {
    console.error(`❌ [AutoPublish] Error publicando "${job.title}":`, err.message);
    // Revertir el lock si el webhook falló
    await supabase.from('video_jobs').update({
      status: 'ready_to_publish',
      published_at: null
    }).eq('id', job.id);
    return false;
  }
}

// ─── LÓGICA PRINCIPAL ────────────────────────────────────────────────────────
export async function checkAndRender() {
  try {
    const config = await getConfig();

    // 1. Kill-Switch global
    if (config.automation_enabled === false) {
      console.log('[Autofill] ⏸️ Automatización en PAUSA por configuración.');
      return;
    }

    // ── BLOQUE A: Auto-publicación de hasta 5 videos por día ──────────────────
    const dailyTarget = Number(config.daily_target_videos) || 5;

    // Calcular inicio del día actual (medianoche local → UTC)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: publishedToday } = await supabase
      .from('video_jobs')
      .select('id')
      .eq('status', 'published')
      .gte('published_at', todayStart.toISOString());

    const publishedCount = (publishedToday || []).length;

    if (publishedCount < dailyTarget) {
      const remaining = dailyTarget - publishedCount;
      console.log(`[AutoPublish] Publicados hoy: ${publishedCount}/${dailyTarget}. Buscando ${remaining} video(s) para publicar...`);

      // Buscar videos listos (con video final) ordenados por más antiguos primero
      const { data: readyVideos } = await supabase
        .from('video_jobs')
        .select('id, title, final_video_url, copy_text, image_url, image_copy_text, brand_id')
        .eq('status', 'ready_to_publish')
        .not('final_video_url', 'is', null)
        .order('created_at', { ascending: true })
        .limit(remaining);

      for (const video of (readyVideos || [])) {
        console.log(`[AutoPublish] → Publicando automáticamente: "${video.title}"`);
        await autoPublishVideo(video, config);
        // Pequeña pausa entre publicaciones para no saturar n8n
        await new Promise(r => setTimeout(r, 3000));
      }
    } else {
      console.log(`[AutoPublish] Meta diaria cumplida: ${publishedCount}/${dailyTarget} videos publicados hoy. ✅`);
    }

    // ── BLOQUE B: Renderizar videos pendientes ─────────────────────────────────
    // IMPORTANTE: NO incluir 'rendering' — si ya está procesando, isRunning lo bloquea
    let { data: pendingJob } = await supabase
      .from('video_jobs')
      .select('id, title, status')
      .is('final_video_url', null)
      .in('status', ['ready_to_publish', 'needs_review'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    // ── BLOQUE C: Si no hay pendientes, jalar del Vault si la cola está baja ──
    if (!pendingJob) {
      const minBuffer = Number(config.min_queue_buffer) || 3;

      const { data: readyVideos } = await supabase
        .from('video_jobs')
        .select('id')
        .eq('status', 'ready_to_publish')
        .not('final_video_url', 'is', null);

      const readyCount = (readyVideos || []).length;
      console.log(`[Autofill] Cola lista: ${readyCount} videos. Buffer mínimo: ${minBuffer}.`);

      if (readyCount < minBuffer) {
        // Traer títulos existentes para evitar duplicados
        const { data: existingJobs } = await supabase.from('video_jobs').select('title');
        const existingTitles = new Set((existingJobs || []).map(j => (j.title || '').trim().toLowerCase()));

        const { data: vaultItems, error: vaultErr } = await supabase
          .from('content_vault')
          .select('*')
          .eq('status', 'stored')
          .neq('title', 'El Error de la Cáscara de Huevo')
          .order('created_at', { ascending: true })
          .limit(10);

        if (vaultErr) {
          console.error('[Autofill] Error consultando content_vault:', vaultErr.message);
          return;
        }

        const candidate = (vaultItems || []).find(v => !existingTitles.has((v.title || '').trim().toLowerCase()));

        if (candidate) {
          console.log(`[Autofill] 📥 Promoviendo del Vault: "${candidate.title}"`);
          const { data: createdJob, error: createErr } = await supabase
            .from('video_jobs')
            .insert({
              title: candidate.title,
              topic: candidate.pilar || candidate.title,
              pilar: candidate.pilar,
              angulo: candidate.angulo,
              clima_luz: candidate.clima_luz,
              copy_text: candidate.copy_text,
              hashtags: candidate.hashtags || [],
              scene_1_prompt: candidate.scene_1_prompt,
              scene_2_prompt: candidate.scene_2_prompt,
              scene_3_prompt: candidate.scene_3_prompt,
              image_prompt: candidate.image_prompt,
              image_copy_text: candidate.image_copy_text,
              status: 'ready_to_publish',
              aspect_ratio: '9:16',
              target_platforms: ['facebook'],
              brand_id: candidate.brand_id || '06a68062-00c0-413d-b41f-b2229b9d52da',
              retry_count: 0
            })
            .select()
            .single();

          if (createErr) {
            console.error('[Autofill] Error creando video_job:', createErr.message);
            return;
          }

          await supabase
            .from('content_vault')
            .update({ status: 'in_queue' })
            .eq('id', candidate.id);

          pendingJob = createdJob;
        } else {
          console.log('[Autofill] No hay ideas disponibles en el Vault con estado "stored".');
        }
      }
    }

    // ── BLOQUE D: Disparar render del siguiente pendiente ─────────────────────
    if (pendingJob) {
      console.log(`[Autofill] 🎬 Disparando render: ${pendingJob.id} - "${pendingJob.title}"`);
      try {
        const res = await fetch('http://localhost:3001/api/flow/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: pendingJob.id, mode: 'full' })
        });
        const resJson = await res.json();
        console.log('[Autofill] Respuesta API Flow:', resJson);
      } catch (fetchErr) {
        console.warn('[Autofill] No se pudo conectar a Flow API (posiblemente ocupado):', fetchErr.message);
      }
    } else {
      console.log('[Autofill] ✅ Todo procesado. Sin contenido pendiente.');
    }

  } catch (err) {
    console.error('[Autofill] Error inesperado:', err.message);
  }
}

export { checkAndRender as default };

// Si se ejecuta directamente desde CLI:
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  checkAndRender();
  setInterval(checkAndRender, 60 * 1000);
}
