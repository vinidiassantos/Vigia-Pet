import { GoogleGenAI } from "@google/genai";

// Inicializa o SDK do Gemini
const API_KEY = "SUA_CHAVE_API_AQUI"; // Substitua pela sua chave do Google AI Studio
const ai = new GoogleGenAI({ apiKey: API_KEY });

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

export async function analisarComportamentoPet(promptTexto, mediaFile = null) {
  try {
    const model = "gemini-2.5-flash";
    
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
