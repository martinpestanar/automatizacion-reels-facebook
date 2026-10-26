import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

const PILARES = [
  'Pilar 1: Micro-Ecosistemas & Suelo Vivo',
  'Pilar 2: Botánica Rebelde & Chaos Gardening',
  'Pilar 3: Ciencia Orgánica Sin Mitos',
  'Pilar 4: Micro-Bosques & Foodscaping Urbano',
  'Pilar 5: Jardines Sensoriales & Nocturnos'
];

const ANGULOS = [
  'A) Secreto Oculto',
  'B) Contraste / Comparación',
  'C) Mito Desmentido',
  'D) Técnica Paso a Paso',
  'E) Nocturno / Sensorial'
];

const LUCES = [
  'L1: Amanecer Dorado',
  'L2: Lluvia de Verano',
  'L3: Luz de Ventana / Invernadero'
];

/**
 * Llamada directa a Google Gemini (Gratis, tier oficial)
 */
async function callGemini(systemInstruction, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

  const payload = {
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json'
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Respuesta vacía de Gemini');

  return JSON.parse(text);
}

/**
 * Genera un lote de cards de contenido ultra-realistas (24s / 3 escenas)
 * usando la API Gratuita de Google Gemini.
 */
export async function generateVaultBatch(targetCount = 10) {
  console.log(`\n🌱 [VaultGenerator: Google Gemini Gratis] Iniciando generación de ${targetCount} cards maestras para Mr. Green...`);

  // 1. Obtener títulos existentes en video_jobs y content_vault para no repetir
  const { data: existingJobs } = await supabase.from('video_jobs').select('title');
  const { data: existingVault } = await supabase.from('content_vault').select('title');

  const blacklist = [
    ...(existingJobs || []).map(j => j.title),
    ...(existingVault || []).map(v => v.title)
  ].filter(Boolean);

  console.log(`📋 [VaultGenerator] Temas excluidos (ya realizados): ${blacklist.length} títulos.`);

  // 2. Construir la matriz equilibrada (2 por pilar para 10 cards)
  const distribution = [];
  for (let i = 0; i < targetCount; i++) {
    const pilarIndex = i % PILARES.length;
    const anguloIndex = i % ANGULOS.length;
    const luzIndex = i % LUCES.length;
    distribution.push({
      pilar: PILARES[pilarIndex],
      angulo: ANGULOS[anguloIndex],
      luz: LUCES[luzIndex]
    });
  }

  const generatedCards = [];

  for (let i = 0; i < distribution.length; i++) {
    const item = distribution[i];
    console.log(`\n✍️ Generando Card ${i + 1}/${targetCount} con Gemini -> [${item.pilar}] (${item.angulo})...`);

    const systemInstruction = `
Eres el Director de Contenido Educativo y Divulgación Botánica de "Mr. Green".
Tu misión es crear videos de 24 segundos exactos (3 escenas de 8.0s) que ENSEÑEN algo de verdadero valor, práctico y sorprendente, EXPLICADO DE FORMA TAN SENCILLA Y CLARA QUE UN NIÑO DE 11 AÑOS LO ENTIENDA AL INSTANTE, pero fascinante para cualquier adulto aficionado a las plantas o al huerto.

PARÁMETROS ASIGNADOS:
- Pilar: ${item.pilar}
- Ángulo: ${item.angulo}
- Clima y Luz: ${item.luz}

REGLA DE ORO DE CONTENIDO (FÓRMULA EDUCATIVA DE 3 ESCENAS - VALOR REAL):
Cada video DEBE tener una lección clara, útil y práctica siguiendo este arco:
- ESCENA 1 (EL ERROR O LA PREGUNTA CURIOSA): Atrapa la atención revelando un error muy común que la gente comete en sus plantas o una pregunta fascinante que nadie sabe responder.
- ESCENA 2 (LA EXPLICACIÓN CIENTÍFICA PARA UN NIÑO DE 11 AÑOS): Explica de forma visual y con analogías sencillas qué pasa por dentro (en las raíces, en la tierra, en el agua, con los bichitos buenos). Cero tecnicismos aburridos; usa comparaciones visuales cotidianas (ej: "las raíces respiran como nosotros", "las hojas actúan como una sombrilla").
- ESCENA 3 (EL CONSEJO PRÁCTICO ACCIONABLE): Da el tip exacto que el espectador puede hacer hoy mismo en su casa o maceta en menos de 1 minuto, cerrando con una invitación a guardar o comentar.

DIRECTIVAS ESTRICTAS DE IDIOMA Y VOZ EN OFF [VOICE SCRIPT]:
- IDIOMA: 100% ESPAÑOL NEUTRO. Queda TERMINANTEMENTE PROHIBIDO cualquier palabra en inglés en la voz y en los textos.
- LOCUCIÓN ESTILO DOCUMENTAL BBC EARTH MODERNO Y ENVOLVENTE (David Attenborough dinámico en español): Narrador naturalista experto, tono barítono profundo, sabio y magnético, pero con RITMO ÁGIL, FLUIDO Y CAUTIVADOR (nada lento ni aburrido). Narra con energía viva y fascinación contagiosa para atrapar la atención desde el primer segundo.
- RITMO Y PALABRAS POR ESCENA: De 14 a 18 palabras por escena (unos 6.0 a 6.8 segundos de locución continua y fluida a 130-135 wpm, dejando solo 1 a 1.2 segundos al final para el remate del efecto sonoro). Cero pausas largas o silencios muertos que hagan el video pesado.
- Cada frase debe enseñar un hecho real o consejo concreto, con esa magia y sabiduría documental clásica de la BBC.

DIRECTIVAS VISUALES Y PROMPTS DE VIDEO [VIDEO GENERATION PROMPT]:
- Formato 9:16 vertical cinematográfico.
- La imagen debe MOSTRAR EXACTAMENTE LO QUE LA VOZ ESTÁ ENSEÑANDO: Demostración práctica real (ej: dedos apretando tierra para ver si drena, hojas secas cubriendo una raíz, agua penetrando en sustrato esponjoso vs charco en tierra dura).
- Fotografía macro hiperrealista, colores vivos naturales, cámara lenta cinematográfica suave, textura táctil orgánica.

REGLAS DE INFOGRAFÍA COMPLEMENTARIA (NANO BANANA 2.1):
- Formato: Infografía botánica vertical 3:4 con alto valor pedagógico visual.
- Diagrama con flechas, llamadas de texto y comparaciones tipo "Bien vs Mal" o "Paso a paso 1, 2, 3".
- Todos los textos dentro de la infografía 100% EN ESPAÑOL.
- Título claro y directo de guía práctica (ej: "3 SEÑALES DE QUE TU TIERRA ESTÁ VIVA").
- NUNCA incluir en el prompt de la imagen la palabra "Nano Banana" ni términos técnicos del sistema para evitar que el modelo de imagen los imprima como texto en la tarjeta.
- Sutil marca "Mr. Green" en la esquina.
- Copy de la imagen con pregunta directa y CTA para guardar la publicación.

ESTRUCTURA EXACTA REQUERIDA EN CADA ESCENA:
[SCENE SPECIFICATIONS]
Duration: 8.0 seconds exact (00:00 - 00:08)
Format: 9:16 vertical
Atmosphere: [Luz natural y entorno]
Visual Palette: [Colores orgánicos y texturas naturales]
[ON-SCREEN MOTION GRAPHIC]
Time: [00:00.2 a 00:02.8 en Escena 1 con título didáctico en español / None en Escena 2 y 3] | Text: [Texto corto en mayúsculas en español] | Style: Tipografía limpia, blanca y legible sobre fondo natural
[AUDIO & SOUND DESIGN]
SFX Hook / Transition: [Efecto sonoro nítido y placentero] | Background Music: Música acústica inspiradora o violonchelo envolvente | SFX Ambience / Action: Sonidos táctiles orgánicos (tierra crujiendo, gotas, hojas)
[VOICE DIRECTIVE]
Speaker Persona: Narrador documental estilo BBC Earth moderno (David Attenborough en español neutro con ritmo ágil), tono barítono profundo, sabio pero con energía dinámica y cautivadora (130-135 wpm), cero pausas lentas ni silencios aburridos, explicando la naturaleza de forma fascinante para un niño de 11 años.
[VOICE SCRIPT]
"[Guion educativo de 11 a 15 palabras en español que enseña un concepto directo]"
[VIDEO GENERATION PROMPT]
Lente macro 85mm o 50mm, f/2.8, 9:16 vertical. [Acción visual explicativa que demuestra la lección]. Demostración clara, movimiento lento cinematográfico, BBC nature documentary style, nitidez 4K.

FORMATO DE SALIDA: JSON estricto con:
{
  "title": "Título educativo y atractivo en español",
  "pilar": "${item.pilar}",
  "angulo": "${item.angulo}",
  "clima_luz": "${item.luz}",
  "copy_text": "🌱 ¿SABÍAS ESTO DE TUS PLANTAS? Explicación sencilla en 2 líneas. El truco práctico para aplicar hoy. Guarda este video 📌 y cuéntanos si lo sabías 👇 #MrGreen #PlantasEnCasa #AprendeBotanica",
  "hashtags": ["#MrGreen", "#PlantasEnCasa", "#HuertoUrbano", "#TipsDeJardineria"],
  "scene_1_prompt": "...",
  "scene_2_prompt": "...",
  "scene_3_prompt": "...",
  "image_prompt": "Infografía botánica explicativa en español con Nano Banana 2.1, ratio vertical 3:4. Diagrama educativo paso a paso con flechas y etiquetas en español: [detalle del diagrama]. Fondo orgánico limpio, estética didáctica moderna, 100% texto en español, sutil marca 'Mr. Green'.",
  "image_copy_text": "📌 GUÍA RÁPIDA: Guarda esta infografía para no olvidar este consejo en tu jardín o maceta. ¿Cuál es tu experiencia? Déjamelo en los comentarios 👇 #MrGreen #HuertoEnCasa"
}
`;

    const userPrompt = `Genera un video completamente nuevo y original sobre ${item.pilar}.
TÍTULOS QUE NO PUEDES REPETIR BAJO NINGUNA CIRCUNSTANCIA:
${blacklist.slice(-40).join(', ')}`;

    try {
      const card = await callGemini(systemInstruction, userPrompt);

      // Normalizar prompts en caso de variaciones de claves devueltas por la IA
      const s1 = card.scene_1_prompt || card.scene1_prompt || card.scene_1 || '';
      const s2 = card.scene_2_prompt || card.scene2_prompt || card.scene_2 || s1;
      const s3 = card.scene_3_prompt || card.scene3_prompt || card.scene_3 || s2;

      // Guardar en content_vault en Supabase con status 'stored'
      const { data: inserted, error: insertErr } = await supabase
        .from('content_vault')
        .insert({
          title: card.title,
          pilar: card.pilar || item.pilar,
          angulo: card.angulo || item.angulo,
          clima_luz: card.clima_luz || item.luz,
          copy_text: card.copy_text,
          hashtags: card.hashtags || ['#MrGreen', '#HuertoEnCasa'],
          scene_1_prompt: s1,
          scene_2_prompt: s2,
          scene_3_prompt: s3,
          image_prompt: card.image_prompt || '',
          image_copy_text: card.image_copy_text || '',
          status: 'stored',
          brand_id: '06a68062-00c0-413d-b41f-b2229b9d52da'
        })
        .select()
        .single();

      if (insertErr) {
        console.error(`❌ Error guardando card "${card.title}" en BD:`, insertErr.message);
      } else {
        console.log(`✅ Card guardada en content_vault (Gemini): "${card.title}" (ID: ${inserted.id})`);
        blacklist.push(card.title);
        generatedCards.push(inserted);
      }

      // Pausa ligera entre llamadas
      await new Promise(r => setTimeout(r, 1000));

    } catch (genErr) {
      console.error(`⚠️ Error generando Card ${i + 1}:`, genErr.message);
    }
  }

  console.log(`\n🎉 [VaultGenerator: Gemini] Finalizado: ${generatedCards.length}/${targetCount} cards depositadas en el Vault con éxito.`);
  return generatedCards;
}

// Ejecución directa por CLI: node src/generator/vault_generator_24s.js [cantidad]
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const count = parseInt(process.argv[2], 10) || 10;
  generateVaultBatch(count).then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
