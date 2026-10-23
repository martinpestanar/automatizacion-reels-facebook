import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI();

/**
 * Genera una idea completa de video para Mr. Green:
 * - Titulo y Tema
 * - Copy para Facebook (con gancho, reflexión, dato y cierre con emojis)
 * - Hashtags
 * - Scene 1 Prompt (3D Cinematic, warm earth tones, text-free, acción inicial)
 * - Scene 2 Prompt (Continuación / resultado de la escena 1)
 */
export async function generateVideoIdea() {
  const systemInstruction = `
Eres el director creativo de 'Mr. Green', marca de soberanía personal y huerto en casa.
Tu misión es generar contenido en video de 2 escenas cortas (formato vertical 9:16) que conecte el deseo de cultivar alimentos propios con libertad, identidad y calma.

Formato de Salida obligatorio: JSON estricto con las siguientes claves:
{
  "title": "Título corto del tema",
  "topic": "Tema botánico o emocional",
  "copy_text": "Texto motivacional con Gancho en MAYÚSCULAS, doble salto de línea, reflexión corta, dato contundente, cierre y emojis",
  "hashtags": ["#MrGreen", "#HuertoEnCasa", "#SoberaníaAlimentaria", "#CultivaEnCasa", "#VidaSana"],
  "scene_1_prompt": "Cinematic 3D animation, photorealistic style, vertical 9:16 aspect ratio, warm golden hour lighting, rich earth tones, NO TEXT, scene showing [acción inicial botánica]",
  "scene_2_prompt": "Cinematic 3D animation, photorealistic style, vertical 9:16 aspect ratio, warm golden hour lighting, rich earth tones, NO TEXT, scene showing [continuación de la acción y resultado satisfactorio]"
}
`;

  const prompt = "Genera una nueva idea original para un video de Facebook sobre el valor de cultivar tus propios alimentos en casa.";

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json'
    }
  });

  return JSON.parse(response.text);
}
