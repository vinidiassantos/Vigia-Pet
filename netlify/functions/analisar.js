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
    const apiKey = process.env.GEMINI_API_KEY || "AQ.Ab8RN6KnqtTfjX2vwNYTImF4l3wqRXNvn_5uxnsVCdqgI9G9JA";

    const promptSistema = `Você é um assistente veterinário especialista em comportamento animal do aplicativo Vigia Pet. 
    Analise a imagem recebida da câmera e forneça um diagnóstico amigável, direto e com 3 recomendações práticas rápidas.`;

    const parts = [
      { text: `${promptSistema}\n\n${promptText || "Analise a imagem deste pet."}` }
    ];

    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64
        }
      });
    }

    // Lista de modelos atualizados da geração 3.5 recomendados pela API
    const modelos = [
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash"
    ];

    let resultText = null;
    let ultimoErro = null;

    for (const modelo of modelos) {
      try {
        // Tenta primeiro via a nova Interactions API (v1alpha) exigida para a chave AQ.
        const urlInteractions = `https://generativelanguage.googleapis.com/v1alpha/interactions?key=${apiKey}`;
        const intResponse = await fetch(urlInteractions, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: `models/${modelo}`,
            input: { parts }
          })
        });

        const intData = await intResponse.json();

        if (intResponse.ok) {
          resultText = intData.outputs?.[0]?.text || intData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (resultText) {
            console.log(`✅ Sucesso via Interactions API (${modelo})`);
            break;
          }
        }

        // Se a Interactions API não responder, tenta a rota v1beta legada
        const urlV1Beta = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
        const betaResponse = await fetch(urlV1Beta, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts }] })
        });

        const betaData = await betaResponse.json();

        if (betaResponse.ok && betaData.candidates?.[0]?.content?.parts?.[0]?.text) {
          resultText = betaData.candidates[0].content.parts[0].text;
          console.log(`✅ Sucesso via v1beta (${modelo})`);
          break;
        }

        ultimoErro = intData.error?.message || betaData.error?.message || `Erro no modelo ${modelo}`;
        console.warn(`⚠️ Tentativa no modelo ${modelo} falhou:`, ultimoErro);

      } catch (err) {
        ultimoErro = err.message;
        console.warn(`⚠️ Erro de conexão com ${modelo}:`, err.message);
      }
    }

    if (!resultText) {
      throw new Error(`Não foi possível obter resposta da IA. Detalhe: ${ultimoErro}`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ result: resultText })
    };

  } catch (error) {
    console.error("❌ Erro na Netlify Function:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Erro interno ao processar a IA" })
    };
  }
};