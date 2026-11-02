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
    const { imagesBase64 } = JSON.parse(event.body || "{}");
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) throw new Error("Variável GROQ_API_KEY não configurada.");
    if (!imagesBase64 || imagesBase64.length === 0) throw new Error("Nenhuma imagem recebida.");

    const promptSistema = `Você é um especialista em comportamento animal e identificação de raças, atuando no aplicativo Vigia Pet.
    Sua tarefa é analisar a sequência de imagens de um pet e retornar um JSON estritamente estruturado.

    PASSO 1 - RACIOCÍNIO: Olhe para as imagens. Qual é a espécie? (Cachorro ou Gato). Quais são as características físicas (pelo, orelhas, focinho, porte)? Qual é a postura e a ação do animal (deitado, comendo, correndo, brincando)?
    PASSO 2 - IDENTIFICAÇÃO: Com base nas características, qual é a raça mais provável? (Se for vira-lata, use "SRD").
    PASSO 3 - ANÁLISE COMPORTAMENTAL: O comportamento observado (ex: ficar deitado por muito tempo) é condizente com o esperado para essa raça? (Ex: Um Border Collie parado por muito tempo é atípico; um Bulldog dormindo é típico).

    Retorne APENAS um objeto JSON válido, sem markdown, sem texto antes ou depois, com as seguintes chaves:
    {
      "especie": "Cachorro ou Gato",
      "raca": "Nome da raça ou SRD",
      "comportamento": "Descrição curta do que o pet está fazendo",
      "analise_raca": "Explicação de 1 frase se o comportamento condiz com a raça.",
      "dicas": [
        "Dica 1",
        "Dica 2",
        "Dica 3"
      ],
      "confianca": 85
    }`;

    const content = [{ type: "text", text: promptSistema }];
    const imagensParaEnviar = imagesBase64.slice(0, 3);
    
    imagensParaEnviar.forEach(base64 => {
      content.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${base64}` }
      });
    });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "qwen/qwen3.8-27b", 
        messages: [{ role: "user", content: content }],
        temperature: 0.1,
        max_tokens: 600,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error?.message || "Erro na API da Groq");
    }

    let resultadoTexto = data.choices?.[0]?.message?.content || "{}";

    // --- LIMPEZA EXTRA (GARANTIA) ---
    // Remove blocos de código markdown (```json ... ```) se a IA teimar em colocar
    resultadoTexto = resultadoTexto.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // Extrai apenas o conteúdo entre a primeira chave { e a última }
    const inicioJson = resultadoTexto.indexOf('{');
    const fimJson = resultadoTexto.lastIndexOf('}');
    
    if (inicioJson !== -1 && fimJson !== -1) {
        resultadoTexto = resultadoTexto.substring(inicioJson, fimJson + 1);
    }

    // Valida se o JSON é perfeitamente parseável
    try {
        JSON.parse(resultadoTexto);
    } catch (e) {
        console.error("JSON inválido gerado pela IA:", resultadoTexto);
        throw new Error("A IA gerou um formato inválido. Tente novamente.");
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ result: resultadoTexto })
    };

  } catch (error) {
    console.error("❌ Erro no Backend:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};