// Chave da API configurada para o Vigia Pet
const API_KEY = "AQ.Ab8RN6LqIS9EwrpeeRUVN3WpCsJJVvIQpFbgRenhLxmNIYhvpQ";

/**
 * Converte o ficheiro de imagem da câmara para Base64
 */
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Busca dinamicamente os modelos disponíveis ou aplica o modelo padrão ativo (gemini-3.8-flash)
 */
async function obterModeloValido() {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
    const data = await res.json();
    
    if (data.models && data.models.length > 0) {
      const modeloCompativel = data.models.find(m => 
        m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")
      );
      if (modeloCompativel) {
        return modeloCompativel.name.replace("models/", "");
      }
    }
  } catch (e) {
    console.warn("Não foi possível listar os modelos dinamicamente, utilizando padrão:", e);
  }
  
  // Modelo exigido pelo endpoint da Google para chaves ativas no AI Studio
  return "gemini-3.8-flash";
}

/**
 * Envia o frame da câmara para a API REST do Gemini
 */
export async function analisarComportamentoPet(promptTexto, mediaFile = null) {
  if (!API_KEY) {
    alert("❌ Chave da API do Gemini ausente.");
    throw new Error("Chave da API do Gemini ausente.");
  }

  let base64Data = null;
  if (mediaFile) {
    base64Data = await fileToBase64(mediaFile);
  }

  const promptSistema = `Você é um assistente veterinário especialista em comportamento animal do aplicativo Vigia Pet. 
  Analise a imagem recebida da câmara e forneça um diagnóstico amigável, direto e com 3 recomendações práticas rápidas.`;

  const parts = [{ text: `${promptSistema}\n\n${promptTexto}` }];
  if (base64Data) {
    parts.push({
      inline_data: {
        mime_type: "image/jpeg",
        data: base64Data
      }
    });
  }

  try {
    const nomeModelo = await obterModeloValido();
    console.log(`🤖 Modelo selecionado para requisição: ${nomeModelo}`);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${nomeModelo}:generateContent?key=${API_KEY}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: parts }]
      })
    });

    const data = await response.json();

    if (response.ok) {
      const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textResult) {
        return textResult;
      }
    }

    console.error("❌ Erro retornado pela API do Google:", data);
    alert(`Erro no Google AI (${response.status}): ${data.error?.message || 'Falha na resposta'}`);
    throw new Error(`Erro ${response.status}`);

  } catch (error) {
    console.error("❌ Falha na análise:", error);
    throw error;
  }
}