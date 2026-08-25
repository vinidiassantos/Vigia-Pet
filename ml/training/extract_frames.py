# ml/training/extract_frames.py
import cv2
import os
import random
from tqdm import tqdm

def extrair_frames(video_path, num_frames=20, frame_step=10, img_size=(224, 224)):
    """
    Extrai num_frames de um vídeo com intervalo de frame_step entre eles.
    """
    try:
        cap = cv2.VideoCapture(video_path)
        video_length = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if video_length <= 0:
            return None

        need_length = 1 + (num_frames - 1) * frame_step
        if need_length > video_length:
            start = 0
        else:
            max_start = video_length - need_length
            start = random.randint(0, max_start)
        cap.set(cv2.CAP_PROP_POS_FRAMES, start)

        frames = []
        for _ in range(num_frames):
            ret, frame = cap.read()
            if not ret:
                break
            frame = cv2.resize(frame, img_size)
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append(frame)
            for _ in range(frame_step):
                cap.read()

        cap.release()
        return frames
    except Exception as e:
        print(f"❌ Erro ao processar {video_path}: {e}")
        return None

def processar_videos(base_video_dir, base_frame_dir, num_frames=20):
    """Processa todos os vídeos na estrutura de pastas."""
    for categoria in os.listdir(base_video_dir):
        video_cat_path = os.path.join(base_video_dir, categoria)
        if not os.path.isdir(video_cat_path):
            continue

        frame_cat_path = os.path.join(base_frame_dir, categoria)
        os.makedirs(frame_cat_path, exist_ok=True)

        video_files = [f for f in os.listdir(video_cat_path) if f.endswith('.mp4')]
        print(f"📹 Processando {len(video_files)} vídeos da categoria: {categoria}")

        for video_file in tqdm(video_files):
            video_path = os.path.join(video_cat_path, video_file)
            frames = extrair_frames(video_path, num_frames=num_frames)
            if frames is None:
                continue

            video_name = os.path.splitext(video_file)[0]
            for i, frame in enumerate(frames):
                frame_path = os.path.join(frame_cat_path, f"{video_name}_frame_{i:04d}.jpg")
                frame_bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                cv2.imwrite(frame_path, frame_bgr)

if __name__ == "__main__":
    processar_videos('./dataset/raw_videos', './dataset/frames', num_frames=20)
    print("✅ Extração de frames concluída!")