# ml/training/train_model.py
import tensorflow as tf
from tensorflow.keras.preprocessing.image import ImageDataGenerator
import os

# Configurações
IMG_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 20

# Carregar dados
train_datagen = ImageDataGenerator(
    rescale=1./255,
    rotation_range=20,
    width_shift_range=0.2,
    height_shift_range=0.2,
    shear_range=0.2,
    zoom_range=0.2,
    horizontal_flip=True,
    fill_mode='nearest'
)

train_generator = train_datagen.flow_from_directory(
    '../dataset/frames',
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode='categorical'
)

# Modelo base (MobileNetV2 - leve para celular)
base_model = tf.keras.applications.MobileNetV2(
    input_shape=(IMG_SIZE, IMG_SIZE, 3),
    include_top=False,
    weights='imagenet'
)
base_model.trainable = False

model = tf.keras.Sequential([
    base_model,
    tf.keras.layers.GlobalAveragePooling2D(),
    tf.keras.layers.Dense(128, activation='relu'),
    tf.keras.layers.Dropout(0.3),
    tf.keras.layers.Dense(3, activation='softmax')  # 3 classes
])

model.compile(
    optimizer='adam',
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

print("🚀 Iniciando treinamento...")
history = model.fit(
    train_generator,
    epochs=EPOCHS,
    validation_data=train_generator,
    verbose=1
)

# Salvar modelo
os.makedirs('../models', exist_ok=True)
model.save('../models/pet_behavior_model.h5')
print("✅ Modelo salvo como .h5!")

# Converter para TensorFlow Lite
converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
tflite_model = converter.convert()

with open('../models/pet_behavior_model.tflite', 'wb') as f:
    f.write(tflite_model)

print("✅ Modelo convertido para TFLite e salvo!")