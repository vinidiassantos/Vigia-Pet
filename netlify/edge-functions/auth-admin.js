// netlify/edge-functions/auth-admin.js

export default async (request, context) => {
  const url = new URL(request.url);
  const password = Netlify.env.get("PROTECTED_PAGE_PASSWORD");

  // Se a variável não estiver configurada, bloqueia o acesso completamente
  if (!password) {
    return new Response(
      "Esta página ainda não foi configurada. Defina a variável PROTECTED_PAGE_PASSWORD no painel do Netlify.",
      { status: 403 }
    );
  }

  // Verifica o cookie de sessão
  const cookieHeader = request.headers.get("cookie") || "";
  const sessionCookie = cookieHeader
    .split(";")
    .find((c) => c.trim().startsWith("admin_session="));

  if (sessionCookie) {
    const token = sessionCookie.split("=")[1];
    const expectedToken = await hashPassword(password);
    
    if (token === expectedToken) {
      // Sessão válida! Agora reescrevemos a rota para entregar o admin.html
      url.pathname = "/admin.html";
      return context.next(new Request(url, request));
    }
  }

  // Se for uma requisição POST (envio do formulário de senha)
  if (request.method === "POST") {
    const formData = await request.formData();
    const submittedPassword = formData.get("password");

    if (submittedPassword === password) {
      const token = await hashPassword(password);
      const response = new Response(null, {
        status: 302,
        headers: {
          Location: url.pathname, // Redireciona de volta para /admin
          "Set-Cookie": `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`,
        },
      });
      return response;
    } else {
      return new Response(renderLoginPage("Senha incorreta. Tente novamente."), {
        status: 401,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  }

  // Sem sessão, mostra o formulário de login
  return new Response(renderLoginPage(), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};

// Hash SHA-256 para o token do cookie
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// HTML do formulário de login
function renderLoginPage(error = "") {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Admin - VIGIA PET</title>
      <style>
        body { font-family: 'Nunito', sans-serif; background: #F8FAFC; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .login-box { background: #fff; padding: 32px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); width: 100%; max-width: 360px; text-align: center; }
        h1 { color: #0F172A; font-size: 20px; margin-bottom: 8px; }
        p { color: #64748B; font-size: 14px; margin-bottom: 20px; }
        input[type="password"] { width: 100%; padding: 12px; border: 1px solid #E2E8F0; border-radius: 10px; font-size: 14px; margin-bottom: 16px; box-sizing: border-box; }
        button { width: 100%; padding: 14px; background: #F97316; color: #fff; border: none; border-radius: 12px; font-weight: 700; font-size: 16px; cursor: pointer; }
        button:hover { background: #EA580C; }
        .error { color: #DC2626; font-size: 13px; margin-bottom: 12px; }
      </style>
    </head>
    <body>
      <div class="login-box">
        <h1>Acesso Restrito</h1>
        <p>Painel de Administração do VIGIA PET</p>
        ${error ? `<div class="error">${error}</div>` : ""}
        <form method="POST">
          <input type="password" name="password" placeholder="Digite a senha" required autofocus>
          <button type="submit">Entrar</button>
        </form>
      </div>
    </body>
    </html>
  `;
}