// backend/functions/index.js
const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenAI } = require("@google/genai");
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");
const os = require("os");

admin.initializeApp();
const db = admin.firestore();

// Inicializa a SDK com a chave de API
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

exports.analisarVideo = onRequest({ cors: true }, async (req, res) => {
  let tempFilePath = "";
  let uploadResult = null;

  try {
    const { petId, videoStoragePath } = req.body;

    if (!videoStoragePath) {
      return res.status(400).json({ error: "O caminho do vídeo no Firebase Storage (videoStoragePath) é obrigatório." });
    }

    // 1. Baixar vídeo do Firebase Storage para pasta temporária do Cloud Functions
    const bucket = admin.storage().bucket();
    tempFilePath = path.join(os.tmpdir(), `pet_video_${Date.now()}.mp4`);
    await bucket.file(videoStoragePath).download({ destination: tempFilePath });

    // 2. Upload para a File API do Gemini (necessário para arquivos de mídia/vídeo)
    uploadResult = await ai.files.upload({
      file: tempFilePath,
      mimeType: "video/mp4",
    });

    // 3. Aguardar o processamento do vídeo no Gemini
    let fileState = await ai.files.get({ name: uploadResult.name });
    while (fileState.state === "PROCESSING") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      fileState = await ai.files.get({ name: uploadResult.name });
    }

    if (fileState.state === "FAILED") {
      throw new Error("Falha no processamento do vídeo pelo Gemini.");
    }

    // 4. Prompt Especialista em Comportamento e Raças Caninas/Felinas
    const prompt = `
Você é um especialista em etologia (comportamento animal) e raças de cães e gatos.
Analise este vídeo com atenção e retorne EXCLUSIVAMENTE um objeto JSON válido no seguinte formato:

{
  "racaProvavel": "Nome da raça identificada ou 'SRD / Misto' caso seja vira-lata",
  "comportamento": "Escolha UMA das opções: [Dormindo, Comendo, Agitado, Brincando, Bravo, Estressado, Outro]",
  "descricao": "Descreva o que o pet está fazendo no vídeo de forma clara.",
  "dica": "Uma dica prática e útil para o dono com base no comportamento observado.",
  "alerta": false,
  "detalhesAlerta": "Descreva caso 'alerta' seja true (sinais de dor, estresse extremo ou perigo), senão deixe vazio."
}
    `;

    // 5. Chamada da API do Gemini exigindo resposta JSON estruturada
    let responseText = "";
    let modeloUsado = "gemini-2.5-flash";

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [uploadResult, prompt],
        config: { responseMimeType: "application/json" }
      });
      responseText = response.text;
    } catch (err) {
      console.warn("Fallback para gemini-2.5-pro...", err);
      modeloUsado = "gemini-2.5-pro";
      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: [uploadResult, prompt],
        config: { responseMimeType: "application/json" }
      });
      responseText = response.text;
    }

    const resultadoJSON = JSON.parse(responseText);

    // 6. Salvar Análise no Firestore
    const docRef = await db.collection("analises").add({
      petId: petId || "desconhecido",
      videoStoragePath,
      resultado: resultadoJSON,
      modeloUsado,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // 7. Limpeza dos arquivos temporários
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    if (uploadResult) await ai.files.delete({ name: uploadResult.name }).catch(() => {});

    return res.status(200).json({
      success: true,
      analiseId: docRef.id,
      data: resultadoJSON
    });

  } catch (error) {
    console.error("Erro na análise do vídeo:", error);
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    if (uploadResult) await ai.files.delete({ name: uploadResult.name }).catch(() => {});
    return res.status(500).json({ error: error.message });
  }
});