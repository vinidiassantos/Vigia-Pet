// functions/api/analisar.js

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { imagesBase64 } = await request.json();
    const apiKey = env.GROQ_API_KEY;

    if (!apiKey) throw new Error("Variável GROQ_API_KEY não configurada.");
    if (!imagesBase64 || imagesBase64.length === 0) throw new Error("Nenhuma imagem recebida.");

    const promptSistema = `Você é um especialista em comportamento animal e identificação de raças, atuando no aplicativo Vigia Pet.
    Sua tarefa é analisar a sequência de imagens de um pet e retornar um JSON estritamente estruturado.

    PASSO 1 - RACIOCÍNIO: Olhe para as imagens. Qual é a espécie? (Cachorro ou Gato). Quais são as características físicas? Qual é a postura e a ação do animal?
    PASSO 2 - IDENTIFICAÇÃO: Qual é a raça mais provável? (Se for vira-lata, use "SRD").
    PASSO 3 - ANÁLISE COMPORTAMENTAL: O comportamento observado condiz com o esperado para essa raça?

    Retorne APENAS um objeto JSON válido, sem markdown, com as chaves:
    {
      "especie": "Cachorro ou Gato",
      "raca": "Nome da raça ou SRD",
      "comportamento": "Descrição curta do que o pet está fazendo",
      "analise_raca": "Explicação de 1 frase se o comportamento condiz com a raça.",
      "dicas": ["Dica 1", "Dica 2", "Dica 3"],
      "confianca": 85
    }`;

    const content = [{ type: "text", text: promptSistema }];
    
    imagesBase64.slice(0, 3).forEach(base64 => {
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
    if (!response.ok) throw new Error(data.error?.message || "Erro na API da Groq");

    let resultadoTexto = data.choices?.[0]?.message?.content || "{}";
    resultadoTexto = resultadoTexto.replace(/```json/gi, '').replace(/```/g, '').trim();
    const inicio = resultadoTexto.indexOf('{');
    const fim = resultadoTexto.lastIndexOf('}');
    if (inicio !== -1 && fim !== -1) resultadoTexto = resultadoTexto.substring(inicio, fim + 1);

    return new Response(JSON.stringify({ result: resultadoTexto }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}