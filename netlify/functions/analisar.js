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
    const { imageBase64, petInfo } = JSON.parse(event.body || "{}");
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("Variável GROQ_API_KEY não configurada.");

    // Personalização básica se houver dados do pet
    const nomePet = petInfo?.name ? petInfo.name : "seu pet";
    const racaPet = petInfo?.breed ? `(raça: ${petInfo.breed})` : "";

    const promptSistema = `Você é um assistente veterinário especialista em comportamento animal do aplicativo Vigia Pet.
    
    Sua tarefa é analisar a imagem de ${nomePet} ${racaPet} e classificá-lo.

    PASSO 1 (Raciocínio): Antes de dar a resposta final, observe com muita atenção a postura do animal, a posição dos olhos, a presença de tigelas/brinquedos e o ambiente. Pense nisso silenciosamente.

    PASSO 2 (Classificação): Baseado na sua observação, classifique o comportamento.
    REGRA CRÍTICA: A primeira linha da sua resposta DEVE ser EXATAMENTE uma destas tags (sem markdown):
    [CATEGORIA: DESCANSO]
    [CATEGORIA: ALIMENTACAO]
    [CATEGORIA: ATIVIDADE]

    PASSO 3 (Formato): Siga EXATAMENTE este formato de resposta:
    Linha 1: A tag da categoria (ex: [CATEGORIA: DESCANSO])
    Linha 2: Uma quebra de linha vazia.
    Linha 3: O diagnóstico (ex: Seu pet está relaxado e dormindo profundamente.)
    Linha 4: Uma quebra de linha vazia.
    Linha 5: - Dica prática 1
    Linha 6: - Dica prática 2
    Linha 7: - Dica prática 3

    Exemplos de classificação:
    - Pet deitado, dormindo, olhos fechados: [CATEGORIA: DESCANSO]
    - Pet comendo, bebendo, focinho na tigela: [CATEGORIA: ALIMENTACAO]
    - Pet correndo, brincando, latindo: [CATEGORIA: ATIVIDADE]
    `;

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
        model: "llama-3.2-11b-vision-preview", // <-- NOVO MODELO DE VISÃO
        messages: [{ role: "user", content: content }],
        temperature: 0.1, // Mantém a IA focada e sem inventar coisas
        max_tokens: 500
      })
    });

    const data = await response.json();
    
    // Se a API da Groq der erro (ex: modelo não encontrado), mostramos no log
    if (!response.ok) {
        console.error("Erro na API da Groq:", data);
        throw new Error(data.error?.message || "Erro na API da Groq");
    }

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