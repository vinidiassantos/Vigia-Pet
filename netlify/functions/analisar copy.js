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
    // ITEM 2: Extraindo a telemetria do body
    const { imagesBase64, sistema_operacional } = JSON.parse(event.body || "{}");
    const apiKey = process.env.GROQ_API_KEY;
    
    // Log da telemetria no console do servidor
    console.log(`📱 [Telemetria] Análise solicitada por um dispositivo: ${sistema_operacional || 'Não informado'}`);

    if (!apiKey) throw new Error("Variável GROQ_API_KEY não configurada.");
    if (!imagesBase64 || imagesBase64.length === 0) throw new Error("Nenhuma imagem recebida.");

    // ITEM 3 e CORREÇÃO: Prompt atualizado com regra de segurança para não-pets
    const promptSistema = `Você é um especialista em comportamento animal, identificação de raças e veterinária preventiva, atuando no aplicativo Vigia Pet.
    Sua base de conhecimento foi treinada com milhares de vídeos reais de pets demonstrando problemas e as soluções que funcionaram.

    REGRA CRÍTICA: Se as imagens NÃO contiverem um cachorro ou gato (ex: se for um humano, um objeto ou a imagem estiver vazia), você DEVE definir "especie" como "Nenhum" e "raca" como "N/A". Neste caso, use o campo "comportamento" para avisar o usuário que nenhum pet foi detectado. Nos outros campos, coloque "Não se aplica".

    Se HOUVER um pet, siga os passos:
    PASSO 1 - RACIOCÍNIO: Olhe para as imagens. Qual é a espécie? (Cachorro ou Gato). Quais são as características físicas? Qual é a postura e a ação do animal?
    PASSO 2 - IDENTIFICAÇÃO: Com base nas características, qual é a raça mais provável? (Se for vira-lata, use "SRD").
    PASSO 3 - ANÁLISE COMPORTAMENTAL: O comportamento observado é condizente com o esperado para essa raça? 
    PASSO 4 - APRENDIZADO POR VÍDEO (TRATAMENTO): Identifique se o comportamento sugere algum problema (estresse, tédio, dor). Sugira um tratamento prático baseado em casos de sucesso.

    Retorne APENAS um objeto JSON válido, sem markdown, sem texto antes ou depois, com as seguintes chaves:
    {
      "especie": "Cachorro", "Gato" ou "Nenhum",
      "raca": "Nome da raça", "SRD" ou "N/A",
      "comportamento": "Descrição curta do que o pet está fazendo (ou aviso de que não há pet)",
      "analise_raca": "Explicação de 1 frase se o comportamento condiz com a raça (ou 'Não se aplica').",
      "tratamento": "Sugestão de tratamento ou 'Não se aplica'.",
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
        temperature: 0.2, 
        max_tokens: 800,  
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
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