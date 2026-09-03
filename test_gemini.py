# test_gemini.py
import os
import google.generativeai as genai

# Carregar a chave manualmente (sem dotenv para evitar problemas)
GEMINI_API_KEY = "gen-lang-client-0488504161"

if not GEMINI_API_KEY:
    print("❌ Chave da API não encontrada!")
    exit(1)

print(f"✅ Chave da API carregada: {GEMINI_API_KEY[:10]}...")

# Configurar o Gemini
genai.configure(api_key=GEMINI_API_KEY)

# Escolher o modelo
model = genai.GenerativeModel('gemini-2.0-flash-exp')

# Teste rápido
try:
    response = model.generate_content("O que você sabe sobre comportamento de cachorros?")
    print("\n📊 RESPOSTA DO GEMINI:")
    print(response.text)
    print("\n✅ Conectado com sucesso!")
except Exception as e:
    print(f"❌ Erro: {e}")