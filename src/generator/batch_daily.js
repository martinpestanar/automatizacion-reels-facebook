import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ai = new GoogleGenAI();

/**
 * Genera el paquete diario de 5 videos respetando las reglas de no-repetición del Manual Maestro:
 * - 5 pilares distintos
 * - 5 ángulos de enfoque distintos
 * - Horarios pico distribuidos
 * - 3 escenas x 6s (18s total)
 */
export async function generateDailyBatch(brandSlug = 'mr-green') {
  console.log(`\n🌱 Iniciando generación de Pack Diario de 5 Videos para ${brandSlug}...`);

  const { data: brand } = await supabase.from('brands').select('*').eq('slug', brandSlug).single();
  const { data: templates } = await supabase.from('brand_templates').select('*').eq('brand_id', brand.id);

  // Pilares sugeridos para el día
  const dailySchedule = [
    { hour: '07:30', pilar: 'Pilar 2: De Residuo a Cosecha (Regrow)', angulo: 'E) Transformación Time-Lapse', luz: 'L1: Amanecer Dorado' },
    { hour: '11:00', pilar: 'Pilar 6: Diagnóstico Visual y Errores Silenciosos', angulo: 'A) El Error Silencioso', luz: 'L3: Luz de Ventana / Invernadero' },
    { hour: '14:30', pilar: 'Pilar 3: Guerra Microscópica (Control de Plagas)', angulo: 'D) Batalla Microscópica', luz: 'L1: Amanecer Dorado' },
    { hour: '18:00', pilar: 'Pilar 4: Alquimia Orgánica (Biofertilizantes)', angulo: 'C) Ciencia de la Abuela', luz: 'L3: Luz de Ventana / Invernadero' },
    { hour: '20:30', pilar: 'Pilar 5: Selvas Comestibles en Balcón (Asociación)', angulo: 'B) El Secreto Subterráneo', luz: 'L2: Lluvia de Verano' }
  ];

  const generatedJobs = [];

  for (const item of dailySchedule) {
    const tmpl = templates.find(t => t.pillar_name.includes(item.pilar.split(':')[0])) || templates[0];

    const prompt = `
Eres el director de Mr. Green. Genera 1 video según el Manual Maestro:
- Pilar: ${item.pilar}
- Ángulo: ${item.angulo}
- Clima/Luz: ${item.luz}

Devuelve un JSON estricto con:
{
  "title": "Título corto y directo",
  "copy_text": "Pregunta de interacción + reflexión corta + emojis + 3 hashtags",
  "hashtags": ["#MrGreen", "#HuertoEnCasa", "#Jardineria"],
  "scene_1_prompt": "Prompt 6s Gancho visual y dopamina",
  "scene_2_prompt": "Prompt 6s Revelación invisible y dato técnico",
  "scene_3_prompt": "Prompt 6s Cosecha y cierre con infinite loop"
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const parsed = JSON.parse(response.text);

    const { data: job, error } = await supabase.from('video_jobs').insert({
      title: parsed.title,
      topic: item.pilar,
      pilar: item.pilar,
      angulo: item.angulo,
      clima_luz: item.luz,
      copy_text: parsed.copy_text,
      hashtags: parsed.hashtags,
      scene_1_prompt: parsed.scene_1_prompt,
      scene_2_prompt: parsed.scene_2_prompt,
      scene_3_prompt: parsed.scene_3_prompt,
      status: 'ready_to_publish',
      brand_id: brand.id,
      target_platforms: ['facebook'],
      final_video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
    }).select().single();

    if (!error && job) {
      generatedJobs.push(job);
      console.log(`✅ Creado: [${item.hour}] ${parsed.title}`);
    }
  }

  return generatedJobs;
}
