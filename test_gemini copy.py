# test_gemini.py
import os
import google.generativeai as genai
from dotenv import load_dotenv
import requests
import json

# Carregar a chave do .env
load_dotenv('backend/functions/.env')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

if not GEMINI_API_KEY:
    print("❌ Chave da API não encontrada!")
    print("   Verifique o arquivo .env")
    exit(1)

print(f"✅ Chave da API carregada: {GEMINI_API_KEY[:10]}...")

# Configurar o Gemini
genai.configure(api_key=GEMINI_API_KEY)

# Escolher o modelo
model = genai.GenerativeModel('gemini-2.0-flash-exp')

# Função para analisar vídeo
def analisar_video(video_url):
    print(f"\n📥 Analisando vídeo: {video_url}")
    
    # Prompt para a análise
    prompt = """
    Você é um especialista em comportamento animal.
    Analise este vídeo de um pet e responda em português:

    1. 🐾 QUAL É O COMPORTAMENTO PRINCIPAL?
       (Dormindo / Comendo / Agitado / Brincando / Outro)

    2. 📊 DESCRIÇÃO DETALHADA:
       Descreva o que está acontecendo no vídeo.

    3. 💡 DICA PARA O DONO:
       Dê uma dica prática e útil.

    4. ⚠️ ALERTA:
       Há algum sinal de estresse, doença ou perigo?
       (Sim/Não e explique)
    """
    
    try:
        # Análise com o modelo
        response = model.generate_content([
            prompt,
            video_url
        ])
        
        print("\n" + "="*50)
        print("📊 RESULTADO DA ANÁLISE")
        print("="*50)
        print(response.text)
        print("="*50)
        print("✅ Análise concluída!")
        return response.text
        
    except Exception as e:
        print(f"❌ Erro na análise: {e}")
        return None

# Testar com um vídeo (substitua pela URL que você quer testar)
if __name__ == "__main__":
    # Vídeos para teste
    test_urls = [
        "https://www.youtube.com/watch?v=Ph-jIKt7fZQ",
        # Adicione mais URLs aqui
    ]
    
    for url in test_urls:
        analisar_video(url)