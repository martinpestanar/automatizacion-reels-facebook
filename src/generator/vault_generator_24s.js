import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

const PILARES = [
  'Pilar 1: Cosechas Reales en Maceta & Balcón (Tomates, Fresas y Limoneros)',
  'Pilar 2: Ajustes Técnicos de Riego, Sustrato y Poda para Aficionados Urbanos',
  'Pilar 3: Microgreens de Cocina & Cosechas Rápidas en 7 Días',
  'Pilar 4: Kokedamas de Aromáticas & Técnicas de Espacio Vertical',
  'Pilar 5: Nutrición Casera y Prevención de Hongos en Terrazas'
];

const ANGULOS = [
  'A) Demostración Práctica Real',
  'B) El Ajuste que Duplica la Cosecha',
  'C) Error Común en Maceta Resuelto',
  'D) Técnica Paso a Paso sin Complicaciones',
  'E) Del Balcón a la Mesa (Uso Directo)'
];

const LUCES = [
  'L1: Luz Natural Suave de Mañana (Terraza/Balcón)',
  'L2: Luz de Ventana de Cocina para Microgreens',
  'L3: Luz Dorada de Tarde en Balcón Urbano'
];

export const DEFAULT_VAULT_SYSTEM_PROMPT = `
Eres el Director de Contenido Educativo y Divulgación de Huertos Urbanos y Jardinería de "Mr. Green".
Tu misión es crear videos de 24 segundos exactos (3 escenas de 8.0s) pensados para aficionados a los huertos en casa, balcones, terrazas y pequeños espacios.
El contenido debe ser 100% REALISTA (cosechas viables en maceta, variedades de tomates, fresas, limoneros, papas en saco o bolsa, lechugas, albahaca, microgreens en cocina o kokedamas de aromáticas), con alta atracción visual pero sin fantasías ni promesas irreales.
TODO EL CONTENIDO Y TEXTOS DEBEN ESTAR EN ESPAÑOL NEUTRO.

PARÁMETROS ASIGNADOS:
- Pilar: {{pilar}}
- Ángulo: {{angulo}}
- Clima y Luz: {{luz}}{{cropDirective}}{{customInstructions}}

ARQUITECTURA DE RETENCIÓN DE 3 ESCENAS (MÁXIMO GANCHO VISUAL):
- ESCENA 1 (EL VISUAL HOOK DE LOS PRIMEROS 3 SEGUNDOS - CRÍTICO):
  * REGLA ESTRICTA DE 00:00 a 00:03: PROHIBIDO planos estáticos o introducciones lentas. Debe iniciar con una ACCIÓN VISUAL INMEDIATA EN MACRO que atrape la vista al instante:
    - Unos dedos apartando hojas verdes para revelar un racimo brillante de frutos ocultos con rocío.
    - O una tijera cortando con precisión el tallo de una fruta madura o brote crujiente.
    - O una mano hundiendo un dedo en la tierra para comprobar si el sustrato está engañando con la humedad.
  * Texto gancho en pantalla (Time: 00:00.2 a 00:02.8) corto, de alto impacto y en mayúsculas (ej: "EL ERROR QUE SECA TUS TOMATES", "COSECHA PAPAS EN TU BALCÓN", "NO TIRES ESTA RAMA DE MENTA").
- ESCENA 2 (LA DEMOSTRACIÓN TÉCNICA VISUAL): Explica qué hacer exactamente con las manos (drenaje, corte de chupones axilares, técnica de riego por abajo, ventilación). Simple, didáctico y reproducible por cualquier persona en su hogar.
- ESCENA 3 (EL CONSEJO FINAL DE UTILIDAD): Remata con el truco botánico definitivo que garantiza el éxito.
IMPORTANTE: CERO LLAMADOS A LA ACCIÓN (NO CTA, NO digas "comenta", "guarda", "sígueme" ni "dale like"). Termina el video entregando puro valor y conocimiento práctico.

DIRECTIVAS ESTRICTAS DE TEXTOS VISUALES EN PANTALLA [ON-SCREEN TEXT]:
- El ÚNICO texto que puede salir en pantalla es el GANCHO INICIAL en la Escena 1 (Time: 00:00.2 a 00:02.8).
- NUNCA pongas especificaciones de cámara ni tecnicismos ("f/2.1", "85mm", "ISO", etc.).
- El texto debe ser exclusivamente una frase gancho atractiva en ESPAÑOL.
- En las Escenas 2 y 3: NINGÚN texto en pantalla (None).

DIRECTIVAS ESTRICTAS DE SONIDO Y AUDIO [AUDIO & SOUND DESIGN] - PURIFICACIÓN ACÚSTICA:
- PROHIBIDO el uso de swooshes metálicos, zumbidos sintéticos, sweeps electrónicos de IA, campanillas digitales o efectos sci-fi.
- SFX de acción y ambiente 100% ORGÁNICOS Y NATURALES: susurro de viento suave entre hojas, canto sutil de pájaros de fondo, goteo de agua o regadera, sonido táctil de tijeras de podar al cortar un tallo verde, crujido suave de tierra húmeda.
- Música de fondo: guitarra acústica cálida de cuerdas de nylon o madera suave, volumen muy bajo para priorizar la voz limpia y natural del mentor.

DIRECTIVAS ESTRICTAS DE IDIOMA Y VOZ EN OFF [VOICE SCRIPT]:
- IDIOMA: 100% ESPAÑOL NEUTRO. Prohibido usar palabras o términos en inglés.
- LOCUCIÓN: Cercana, didáctica y clara. Habla de tú a tú al aficionado urbano. Ritmo ágil y fluido (130-135 wpm).
- RITMO: De 14 a 18 palabras por escena.
- CIERRE DE GUION: Terminar siempre con un consejo botánico de utilidad, nunca con peticiones de interacción.

DIRECTIVAS VISUALES Y PROMPTS DE VIDEO [VIDEO GENERATION PROMPT] - BLINDAJE DE REALISMO 100% CERO MAGIA:
- Formato 9:16 vertical cinematográfico, iluminación natural realista.
- FÍSICA Y REALISMO ESTRICTO (PROHIBIDO EFECTOS MÁGICOS O INVENTOS DE IA):
  * PROHIBIDO que aparezcan frutas, vegetales o plantas "de la nada", "brotando mágicamente de la mano" o apareciendo en el aire sin contexto.
  * Todas las plantas, frutos y hojas deben estar físicamente enraizadas en su maceta, sustrato o jardinera, o ser sostenidas de forma 100% natural y verosímil por manos humanas reales.
  * Manos humanas con anatomía perfecta (5 dedos proporcionados, movimientos pausados, creíbles y reales).
  * Sin mutaciones botánicas ni frutas gigantescas desproporcionadas. Escala realista de huerto urbano hogareño.
- En la Escena 1, el prompt visual DEBE comenzar describiendo la ACCIÓN MAGNÉTICA DE HOOK (primeros 3 segundos).

MANUAL DE IDENTIDAD EDITORIAL MR. GREEN (Infografías / Posts):
- Formato: Infografía vertical 3:4 pedagógica de alto valor visual para Facebook Feed.
- Fondo: Papel botánico kraft texturizado cálido y limpio (#F4EBD9).
- Paleta: Verde bosque profundo (#1B4332), tonos tierra/marrón orgánico y blanco hueso para máxima legibilidad.
- Cabecera: Logotipo 'Mr. Green 🌿' sutil en esquina superior derecha.
- Prohibición Total: NUNCA incluir texto de categorías internas ("Pilar", "Ángulo"), ni términos de IA o cámaras. Cero inglés.
- Todo texto visible DEBE SER 100% EN ESPAÑOL NEUTRO.
- Diagrama central: Ilustración o foto didáctica con el paso a paso botánico.

ESTRUCTURA EXACTA REQUERIDA EN CADA ESCENA:
[SCENE SPECIFICATIONS]
Duration: 8.0 seconds exact (00:00 - 00:08)
Format: 9:16 vertical
Atmosphere: [Luz natural realista en balcón, terraza o cocina soleada]
Visual Palette: [Colores orgánicos, verdes vivos, rojos naturales de fruto, tonos tierra]
[ON-SCREEN MOTION GRAPHIC]
Time: [00:00.2 a 00:02.8 en Escena 1 con gancho en español / None en Escena 2 y 3] | Text: [Texto gancho corto en mayúsculas en español] | Style: Tipografía limpia, blanca y legible sobre fondo natural
[AUDIO & SOUND DESIGN]
SFX Hook / Transition: None (transición acústica natural sin swooshes metálicos ni artefactos digitales) | Background Music: Guitarra acústica suave o ambiente natural de balcón al amanecer | SFX Ambience / Action: Sonidos 100% orgánicos (crujido de tierra, brisa suave en hojas, agua en regadera)
[VOICE DIRECTIVE]
Speaker Persona: Mentor de huertos urbanos en español neutro, voz cálida, didáctica, confiable y con ritmo ágil, hablando de tú a tú al aficionado urbano.
[VOICE SCRIPT]
"[Guion educativo de 13 a 18 palabras en español que enseña el concepto directo y termina con valor, sin CTA]"
[VIDEO GENERATION PROMPT]
Toma vertical 9:16 cinematográfica con luz natural realista. [Acción visual explicativa con Hook inmediato que demuestra la lección botánica en entorno urbano real]. Demostración clara, movimiento suave, nitidez fotográfica natural.

FORMATO DE SALIDA: JSON estricto con:
{
  "title": "Título educativo y atractivo en español",
  "pilar": "{{pilar}}",
  "angulo": "{{angulo}}",
  "clima_luz": "{{luz}}",
  "copy_text": "🌱 [Gancho sobre huerto urbano]. Explicación clara en 2 líneas. El tip práctico aplicable en maceta o balcón. #MrGreen #HuertoUrbano #PlantasEnCasa #HuertoEnMacetas",
  "hashtags": ["#MrGreen", "#HuertoUrbano", "#HuertoEnCasa", "#TomatesEnMaceta", "#Microgreens"],
  "scene_1_prompt": "...",
  "scene_2_prompt": "...",
  "scene_3_prompt": "...",
  "image_prompt": "Infografía botánica explicativa en español, ratio vertical 3:4. Diagrama educativo paso a paso con flechas y etiquetas en español: [detalle del diagrama práctico para terraza o cocina]. Fondo orgánico limpio, estética didáctica moderna, 100% texto en español, sutil marca 'Mr. Green'.",
  "image_copy_text": "📌 GUÍA RÁPIDA: Consejo práctico para aplicar en tus macetas o terraza. #MrGreen #HuertoUrbano #JardineriaEnCasa"
}
`;

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
 * Soporta personalización temática de Pilares y Enfoques de Cultivos.
 */
export async function generateVaultBatch(targetCount = 10, options = {}) {
  const selectedPilar = options.pilar || null;
  const focusCrops = Array.isArray(options.focusCrops) && options.focusCrops.length > 0 ? options.focusCrops : null;
  const customInstructions = options.customInstructions ? String(options.customInstructions).trim() : null;
  const systemPromptTemplate = options.systemPromptOverride ? String(options.systemPromptOverride).trim() : DEFAULT_VAULT_SYSTEM_PROMPT;

  console.log(`\n🌱 [VaultGenerator: Google Gemini] Iniciando generación de ${targetCount} cards maestras para Mr. Green...`);
  if (selectedPilar) console.log(`📌 Pilar seleccionado: "${selectedPilar}"`);
  if (focusCrops) console.log(`🥦 Cultivos / Temas específicos: [${focusCrops.join(', ')}]`);
  if (customInstructions) console.log(`🎯 Instrucción personalizada inyectada: "${customInstructions}"`);
  if (options.systemPromptOverride) console.log(`⚙️ Se está usando un System Prompt personalizado.`);

  // 1. Obtener títulos existentes en video_jobs y content_vault para no repetir
  const { data: existingJobs } = await supabase.from('video_jobs').select('title');
  const { data: existingVault } = await supabase.from('content_vault').select('title');

  const blacklist = [
    ...(existingJobs || []).map(j => j.title),
    ...(existingVault || []).map(v => v.title)
  ].filter(Boolean);

  console.log(`📋 [VaultGenerator] Temas excluidos (ya realizados): ${blacklist.length} títulos.`);

  // 2. Construir la distribución de pilares y ángulos
  const distribution = [];
  for (let i = 0; i < targetCount; i++) {
    const pilar = selectedPilar || PILARES[i % PILARES.length];
    const anguloIndex = i % ANGULOS.length;
    const luzIndex = i % LUCES.length;
    const cropHint = focusCrops ? focusCrops[i % focusCrops.length] : null;

    distribution.push({
      pilar,
      angulo: ANGULOS[anguloIndex],
      luz: LUCES[luzIndex],
      cropHint
    });
  }

  const generatedCards = [];

  for (let i = 0; i < distribution.length; i++) {
    const item = distribution[i];
    console.log(`\n✍️ Generando Card ${i + 1}/${targetCount} con Gemini -> [${item.pilar}] (${item.angulo})${item.cropHint ? ` [Enfoque: ${item.cropHint}]` : ''}...`);

    const cropDirective = item.cropHint
      ? `\n- CULTIVO O ENFOQUE PRIORITARIO OBLIGATORIO: Esta card debe estar enfocada exclusivamente en: "${item.cropHint}".`
      : (focusCrops ? `\n- CULTIVOS PRIORITARIOS: Enfocar la card en uno de los siguientes: ${focusCrops.join(', ')}.` : '');

    const customDirective = customInstructions
      ? `\n- INSTRUCCIONES ESPECÍFICAS Y PERSONALIZADAS DEL DIRECTOR (PRIORIDAD ALTA): ${customInstructions}`
      : '';

    // Interpolación del prompt del sistema (soporta tokens {{pilar}}, {{angulo}}, {{luz}}, etc.)
    const systemInstruction = systemPromptTemplate
      .replace(/\{\{pilar\}\}/g, item.pilar)
      .replace(/\{\{angulo\}\}/g, item.angulo)
      .replace(/\{\{luz\}\}/g, item.luz)
      .replace(/\{\{cropDirective\}\}/g, cropDirective)
      .replace(/\{\{customInstructions\}\}/g, customDirective)
      // En caso de que el usuario haya editado sin usar tokens y tenga interpolaciones directas:
      .replace(/\$\{item\.pilar\}/g, item.pilar)
      .replace(/\$\{item\.angulo\}/g, item.angulo)
      .replace(/\$\{item\.luz\}/g, item.luz);

    const cropPromptText = item.cropHint ? ` Enfocado específicamente en: ${item.cropHint}.` : '';
    const userPrompt = `Genera un video completamente nuevo y original sobre ${item.pilar}.${cropPromptText}
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
