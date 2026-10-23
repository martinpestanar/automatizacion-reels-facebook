import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI();

/**
 * Matriz de formatos para intercalar creatividad:
 * 1. infografia_visual: Diagrama limpio botánico
 * 2. macro_fotografia: Macro National Geographic
 * 3. ficha_resumen: Recetario rústico de campo
 * 4. cita_inspiracional: Foto cinematográfica + frase de libertad
 */
export async function generateCompanionImagePrompt(videoConcept, formatCode = 'infografia_visual') {
  const formatsPromptMap = {
    infografia_visual: "Clean botanical infographic design, professional educational diagram, high-resolution cross-section breakdown, neat visual callouts, warm neutral parchment background (#FBF9F5), organic earth tones, sharp focus, 8k resolution, minimalist layout.",
    macro_fotografia: "Award-winning National Geographic macro photography, 100mm f/2.8 lens, exquisite natural texture, golden hour soft morning backlighting, hyper-detailed organic beauty, water droplets glistening on leaf veins, rich forest green (#1B4332) and humus soil tones.",
    ficha_resumen: "Rustic field notebook aesthetic, clean layout on handmade textured paper, botanical watercolor accents, clear recipe layout with jars and natural ingredients neatly arranged on aged oak wood table, soft natural daylight, elegant editorial craft style.",
    cita_inspiracional: "Cinematic moody atmospheric photography, mature weathered human hands gently cupping a vibrant green sprout, soft directional window sunlight breaking through moody shadow, soulful emotional connection with earth, cinematic 35mm film grain, poetic ambiance."
  };

  const systemInstruction = `
Eres el director de arte de 'Mr. Green'.
Tu objetivo es crear una imagen complementaria (ratio 4:5 vertical, 1080x1350) que se publicará en Facebook 30 minutos después del video sobre "${videoConcept.topic}".
El formato seleccionado es: "${formatCode}".
Usa este estilo base: "${formatsPromptMap[formatCode]}".
Regla estricta: La imagen debe incluir sutilmente en la esquina superior derecha la marca "Mr. Green" (#F8F9FA, 35% opacidad).
Devuelve un JSON estricto con:
{
  "image_prompt": "Prompt descriptivo en inglés de alta calidad",
  "image_copy_text": "Copy corto en español con pregunta que dispare comentarios y guardados + 3 hashtags"
}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Genera la imagen satélite para el video titulado: "${videoConcept.title}"`,
    config: {
      systemInstruction,
      responseMimeType: 'application/json'
    }
  });

  return JSON.parse(response.text);
}
