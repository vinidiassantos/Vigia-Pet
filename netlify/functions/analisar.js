// netlify/functions/analisar.js
require("dotenv").config();

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "OK" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method Not Allowed" };

  try {
    const { imageBase64 } = JSON.parse(event.body || "{}");
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("Variável GROQ_API_KEY não configurada.");

    // PROMPT OTIMIZADO COM EXEMPLOS (FEW-SHOT PROMPTING)
    const promptSistema = `Você é um assistente veterinário especialista em comportamento animal do aplicativo Vigia Pet.
    
    Sua tarefa é analisar a imagem de um pet e classificá-lo em uma das 3 categorias.

    REGRA CRÍTICA: A primeira linha da sua resposta DEVE ser EXATAMENTE uma destas tags (sem markdown):
    [CATEGORIA: DESCANSO]
    [CATEGORIA: ALIMENTACAO]
    [CATEGORIA: ATIVIDADE]

    EXEMPLOS DE COMO CLASSIFICAR:
    - Se o pet estiver deitado, dormindo, com olhos fechados ou relaxado: [CATEGORIA: DESCANSO]
    - Se o pet estiver comendo, bebendo água, focinho na tigela ou mastigando: [CATEGORIA: ALIMENTACAO]
    - Se o pet estiver correndo, brincando, latindo, pulando ou muito agitado: [CATEGORIA: ATIVIDADE]

    Após a tag da categoria, pule uma linha e dê um diagnóstico amigável e direto (máximo 2 frases).
    Depois, liste 3 dicas práticas em tópicos (use quebras de linha).`;

    const content = [{ type: "text", text: promptSistema }];
    if (imageBase64) {
      content.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
      });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "qwen/qwen3.8-27b",
        messages: [{ role: "user", content: content }],
        temperature: 0.1 // Temperatura baixa para ser mais preciso e menos "criativo"
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Erro na API da Groq");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ result: data.choices?.[0]?.message?.content })
    };
  } catch (error) {
    console.error("❌ Erro no Backend:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};