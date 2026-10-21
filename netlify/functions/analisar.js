const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "OK" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method Not Allowed" };
  }

  try {
    const { imageBase64, promptText } = JSON.parse(event.body || "{}");

    // Chave de API do Gemini salva nas variáveis de ambiente ou fallback
    const apiKey = process.env.GEMINI_API_KEY || "AQ.Ab8RN6LqIS9EwrpeeRUVN3WpCsJJVvIQpFbgRenhLxmNIYhvpQ";

    if (!apiKey) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Chave da API do Gemini não informada." })
      };
    }

    // Inicializa o SDK oficial
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const promptSistema = `Você é um assistente veterinário especialista em comportamento animal do aplicativo Vigia Pet. 
    Analise a imagem recebida da câmera e forneça um diagnóstico amigável, direto e com 3 recomendações práticas rápidas.`;

    const contents = [
      `${promptSistema}\n\n${promptText || "Analise a imagem deste pet."}`
    ];

    if (imageBase64) {
      contents.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64
        }
      });
    }

    const result = await model.generateContent(contents);
    const textResult = result.response.text();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ result: textResult })
    };

  } catch (error) {
    console.error("❌ Erro na Netlify Function:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Erro interno ao processar requisição da IA." })
    };
  }
};