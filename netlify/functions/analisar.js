// api/analisar.js

// Exportação correta para o Vercel definir o tempo limite
export const maxDuration = 60; 

export default async function handler(req, res) {
  // Configuração de CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  // Trata requisições preflight (OPTIONS)
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { imagesBase64 } = req.body || {};
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) throw new Error("Variável GROQ_API_KEY não configurada no Vercel.");
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

    // Configura o cancelamento automático se a Groq demorar mais de 55 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "qwen/qwen3.8-27b", // Seu modelo original
          messages: [{ role: "user", content: content }],
          temperature: 0.1,
          max_tokens: 600,
          response_format: { type: "json_object" }
        }),
        signal: controller.signal
      });

      const data = await response.json();

      if (!response.ok) {
        // Se a Groq der erro (401, 429, etc.), repassa a mensagem exata
        throw new Error(data.error?.message || "Erro na API da Groq");
      }

      let resultadoTexto = data.choices?.[0]?.message?.content || "{}";

      // --- LIMPEZA EXTRA (GARANTIA) ---
      resultadoTexto = resultadoTexto.replace(/```json/gi, '').replace(/```/g, '').trim();
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

      return res.status(200).json({ result: resultadoTexto });

    } finally {
      clearTimeout(timeoutId);
    }

  } catch (error) {
    console.error("❌ Erro no Backend:", error);
    // Retorna erro em JSON para o frontend não quebrar no JSON.parse
    return res.status(500).json({ error: error.message });
  }
}