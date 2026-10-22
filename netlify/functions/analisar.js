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

    // Lê da variável de ambiente do Netlify ou usa a chave da Groq diretamente
    const apiKey = process.env.GROQ_API_KEY || "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";

    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Variável GROQ_API_KEY não encontrada." })
      };
    }

    const promptSistema = `Você é um assistente veterinário especialista em comportamento animal do aplicativo Vigia Pet. 
    Analise a imagem recebida e forneça um diagnóstico amigável, direto e com 3 recomendações práticas rápidas.`;

    const content = [
      {
        type: "text",
        text: `${promptSistema}\n\n${promptText || "Analise a imagem deste pet."}`
      }
    ];

    if (imageBase64) {
      content.push({
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${imageBase64}`
        }
      });
    }

    // Modelo atualizado para visão na Groq: llama-3.2-90b-vision-preview
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.2-90b-vision-preview",
        messages: [
          {
            role: "user",
            content: content
          }
        ],
        temperature: 0.5
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Erro da Groq:", data);
      throw new Error(data.error?.message || `Erro ${response.status} na API da Groq`);
    }

    const resultText = data.choices?.[0]?.message?.content;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ result: resultText })
    };

  } catch (error) {
    console.error("❌ Erro na Netlify Function (Groq):", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Erro interno ao processar a IA." })
    };
  }
};