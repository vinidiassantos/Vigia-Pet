import { GoogleGenAI } from "@google/genai";

// Obtém a chave de variável de ambiente ou usa a chave local para testes
const API_KEY = (typeof process !== "undefined" && process.env && process.env.GEMINI_API_KEY)
  || (typeof window !== "undefined" && window.GEMINI_API_KEY)
  || "AQ.Ab8RN6IRn7v13rdP0DEDF6AsOnjqN9qkArlc-IDB9HxCqxG81w";

// Inicializa o SDK do Gemini
const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Converte um ficheiro (imagem/vídeo) para o formato base64 necessário para a API do Gemini.
 * @param {File} file 
 * @returns {Promise<{inlineData: {data: string, mimeType: string}}>} 
 */
async function fileToGenerativePart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type
        }
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Envia o relato de texto e/ou a mídia (imagem/vídeo) para o Gemini gerar uma análise comportamental.
 * @param {string} promptTexto - A descrição do comportamento do pet.
 * @param {File|null} mediaFile - Ficheiro de imagem ou vídeo (opcional).
 * @returns {Promise<string>} - Resposta em texto gerada pelo Gemini.
 */
export async function analisarComportamentoPet(promptTexto, mediaFile = null) {
  try {
    const model = "gemini-2.5-flash"; // Modelo recomendado para texto e visão computacional
    
    const promptSistema = `Você é um assistente veterinário especialista em comportamento animal do aplicativo Vigia Pet. 
    Analise o comportamento do pet enviado e forneça um diagnóstico amigável, direto e com recomendações práticas (alimentação, descanso, exercícios ou atenção médica).`;

    const contents = [promptSistema, promptTexto];

    if (mediaFile) {
      const imageOrVideoPart = await fileToGenerativePart(mediaFile);
      contents.push(imageOrVideoPart);
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
    });

    return response.text;
  } catch (error) {
    console.error("Erro ao comunicar com o Gemini AI:", error);
    throw new Error("Não foi possível gerar a análise do pet no momento.");
  }
}