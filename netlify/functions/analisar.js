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

    // Prompt poderoso: define o papel, o raciocínio e o formato JSON exato
    const promptSistema = `Você é um especialista em comportamento animal e identificação de raças, atuando no aplicativo Vigia Pet.
    Sua tarefa é analisar a sequência de imagens de um pet e retornar um JSON estritamente estruturado.

    PASSO 1 - RACIOCÍNIO: Olhe para as imagens. Qual é a espécie? (Cachorro ou Gato). Quais são as características físicas (pelo, orelhas, focinho, porte)? Qual é a postura e a ação do animal (deitado, comendo, correndo, brincando)?
    PASSO 2 - IDENTIFICAÇÃO: Com base nas características, qual é a raça mais provável? (Se for vira-lata, use "SRD").
    PASSO 3 - ANÁLISE COMPORTAMENTAL: O comportamento observado (ex: ficar deitado por muito tempo) é condizente com o esperado para essa raça? (Ex: Um Border Collie parado por muito tempo é atípico; um Bulldog dormindo é típico).

    Retorne APENAS um objeto JSON válido, sem markdown, sem texto antes ou depois, com as seguintes chaves:
    {
      "especie": "Cachorro ou Gato",
      "raca": "Nome da raça ou SRD",
      "comportamento": "Descrição curta do que o pet está fazendo (ex: Dormindo, Comendo, Brincando)",
      "analise_raca": "Explicação de 1 frase se o comportamento condiz com a raça.",
      "dicas": [
        "Dica 1 focada na raça e comportamento",
        "Dica 2",
        "Dica 3"
      ],
      "confianca": 85
    }

    Exemplo para um Border Collie correndo:
    {
      "especie": "Cachorro",
      "raca": "Border Collie",
      "comportamento": "Correndo e brincando ativamente",
      "analise_raca": "O comportamento é totalmente condizente, pois Border Collies possuem energia altíssima e precisam gastar energia.",
      "dicas": [
        "Proporcione brincadeiras que gastem energia física e mental.",
        "Evite deixá-lo muito tempo parado em apartamentos.",
        "Faça treinos de obediência para focar a mente dele."
      ],
      "confianca": 95
    }

    Exemplo para um SRD dormindo:
    {
      "especie": "Cachorro",
      "raca": "SRD",
      "comportamento": "Deitado e relaxado",
      "analise_raca": "Cães SRD têm comportamentos variados, mas o descanso é natural e saudável.",
      "dicas": [
        "Mantenha um local de descanso confortável e longe de barulho.",
        "Observe se ele dorme mais que o normal, pois pode indicar tédio ou problemas de saúde.",
        "Garanta que ele tenha feito suas necessidades antes de dormir."
      ],
      "confianca": 80
    }
    `;

    const content = [{ type: "text", text: promptSistema }];
    
    // A Groq suporta até 3 imagens por requisição. Vamos garantir que não exceda.
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
        temperature: 0.1, // Baixa temperatura para ser mais factual
        max_tokens: 600,
        response_format: { type: "json_object" } // FORÇA O MODO JSON
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
        console.error("Erro na API da Groq:", data);
        throw new Error(data.error?.message || "Erro na API da Groq");
    }

    // Retorna o JSON puro que a IA gerou
    return {
      statusCode: 200,
      headers,
      body: data.choices?.[0]?.message?.content // Já é uma string JSON
    };
  } catch (error) {
    console.error("❌ Erro no Backend:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};