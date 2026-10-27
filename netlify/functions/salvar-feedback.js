// netlify/functions/salvar-feedback.js
const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "OK" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method Not Allowed" };

  try {
    const feedback = JSON.parse(event.body || "{}");

    if (!feedback.tipo) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Campo 'tipo' é obrigatório." }) };
    }

    const store = getStore("feedbacks");
    const key = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    await store.setJSON(key, feedback);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, key }),
    };
  } catch (error) {
    console.error("Erro ao salvar feedback:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};