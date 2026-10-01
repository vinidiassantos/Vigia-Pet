// backend/functions/index.js
const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenAI } = require("@google/genai");
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");
const os = require("os");

admin.initializeApp();
const db = admin.firestore();

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

exports.analisarVideo = onRequest({ cors: true }, async (req, res) => {
  let tempFilePath = "";
  let uploadResult = null;

  try {
    const { petId, videoStoragePath } = req.body;

    if (!videoStoragePath) {
      return res.status(400).json({ error: "O caminho do vídeo é obrigatório." });
    }

    // 1. Download do vídeo do Firebase Storage para diretório temporário
    const bucket = admin.storage().bucket();
    tempFilePath = path.join(os.tmpdir(), `pet_video_${Date.now()}.mp4`);
    await bucket.file(videoStoragePath).download({ destination: tempFilePath });

    // 2. Upload para a File API do Gemini (necessário para processar vídeo)
    uploadResult = await ai.files.upload({
      file: tempFilePath,
      mimeType: "video/mp4",
    });

    // 3. Aguardar o processamento do vídeo no servidor do Gemini
    let fileState = await ai.files.get({ name: uploadResult.name });
    while (fileState.state === "PROCESSING") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      fileState = await ai.files.get({ name: uploadResult.name });
    }

    if (fileState.state === "FAILED") {
      throw new Error("Falha no processamento do vídeo pelo Gemini.");
    }

    // 4. Prompt estruturado focado em raça, comportamento e recomendações
    const prompt = `
Você é um especialista em comportamento animal e raças de cães e gatos.
Analise este vídeo com atenção e retorne EXCLUSIVAMENTE um objeto JSON válido no seguinte formato:

{
  "racaProvavel": "Nome da raça identificada ou 'SRD / Misto'",
  "comportamento": "Escolha UMA opção: [Dormindo, Comendo, Agitado, Brincando, Bravo, Estressado, Outro]",
  "descricao": "Descreva o que o pet está fazendo no vídeo de forma clara.",
  "dica": "Uma dica prática e útil para o dono com base no comportamento observado.",
  "alerta": false,
  "detalhesAlerta": "Descreva se houver dor, estresse ou perigo, senão deixe vazio."
}
    `;

    // 5. Chamada da API Gemini com formato JSON obrigatório
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [uploadResult, prompt],
      config: { responseMimeType: "application/json" }
    });

    const resultadoJSON = JSON.parse(response.text);

    // 6. Registar o histórico da análise no Firestore
    const docRef = await db.collection("analises").add({
      petId: petId || "desconhecido",
      videoStoragePath,
      resultado: resultadoJSON,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // 7. Limpeza dos ficheiros temporários
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    if (uploadResult) await ai.files.delete({ name: uploadResult.name }).catch(() => {});

    return res.status(200).json({
      success: true,
      analiseId: docRef.id,
      data: resultadoJSON
    });

  } catch (error) {
    console.error("Erro na análise do Gemini:", error);
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    if (uploadResult) await ai.files.delete({ name: uploadResult.name }).catch(() => {});
    return res.status(500).json({ error: error.message });
  }
});