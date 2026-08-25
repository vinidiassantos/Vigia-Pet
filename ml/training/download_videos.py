# ml/training/download_videos.py
from pytube import YouTube
import os

# Defina as pastas para cada comportamento
base_dir = './dataset/raw_videos'
categorias = ['dormindo', 'comendo', 'agitado']

# --- ATENÇÃO: Substitua estas listas com seus próprios URLs ---
urls_por_categoria = {
    'dormindo': [
        'https://www.youtube.com/watch?v=OR5W_ZbCACs',
        'https://www.youtube.com/watch?v=Ph-jIKt7fZQ&list=RDPh-jIKt7fZQ&start_radio=1',
    ],
    'comendo': [
        'https://www.youtube.com/watch?v=5elXq0xLFzM',
    ],
    'agitado': [
        'https://www.youtube.com/watch?v=r9-Hd_vuHV4',
    ]
}
# ---------------------------------------------------------------

def baixar_videos(urls, pasta_destino):
    for url in urls:
        try:
            yt = YouTube(url)
            stream = yt.streams.filter(file_extension='mp4', res='720p').first()
            if stream is None:
                stream = yt.streams.filter(file_extension='mp4').first()
            if stream:
                print(f"📥 Baixando: {yt.title}")
                stream.download(output_path=pasta_destino)
            else:
                print(f"❌ Nenhum stream MP4 encontrado para {yt.title}")
        except Exception as e:
            print(f"❌ Erro ao baixar {url}: {e}")

if __name__ == "__main__":
    for categoria, urls in urls_por_categoria.items():
        pasta = os.path.join(base_dir, categoria)
        os.makedirs(pasta, exist_ok=True)
        baixar_videos(urls, pasta)
    print("✅ Download concluído!")