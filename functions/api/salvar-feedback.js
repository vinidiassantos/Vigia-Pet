// functions/api/salvar-feedback.js
export async function onRequestPost(context) {
  try {
    const feedback = await context.request.json();
    console.log("Feedback recebido:", feedback);
    return new Response(JSON.stringify({ message: "OK" }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}