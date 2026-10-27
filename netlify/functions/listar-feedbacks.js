// netlify/functions/listar-feedbacks.js
const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const store = getStore("feedbacks");
    const { blobs } = await store.list();

    const feedbacks = await Promise.all(
      blobs.map(async (blob) => {
        const data = await store.get(blob.key, { type: "json" });
        return { key: blob.key, ...data };
      })
    );

    feedbacks.sort((a, b) => b.key.localeCompare(a.key));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ feedbacks, total: feedbacks.length }),
    };
  } catch (error) {
    console.error("Erro ao listar feedbacks:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};