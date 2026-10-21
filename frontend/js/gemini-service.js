/**
 * Converte a imagem capturada para Base64
 */
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Realiza a chamada para a Netlify Function serverless
 */
export async function analisarComportamentoPet(promptTexto, mediaFile = null) {
  try {
    let base64Data = null;
    if (mediaFile) {
      base64Data = await fileToBase64(mediaFile);
    }

    // Rota automática para ambiente local ou produção na Netlify
    const endpoint = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "/.netlify/functions/analisar" 
      : "https://vigiapet.netlify.app/.netlify/functions/analisar";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promptText: promptTexto,
        imageBase64: base64Data
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Erro ${response.status} na requisição`);
    }

    return data.result;

  } catch (error) {
    console.error("❌ Falha na análise via Serverless Function:", error);
    alert(`Erro na análise: ${error.message}`);
    throw error;
  }
}