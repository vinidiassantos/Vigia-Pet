// MainActivity.kt
// App Android com câmera e IA integrada

class MainActivity : AppCompatActivity() {
    private lateinit var cameraProvider: ProcessCameraProvider
    private lateinit var imageAnalyzer: ImageAnalysis
    private lateinit var tfliteInterpreter: Interpreter
    private lateinit var firestore: FirebaseFirestore
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // Inicializar Firebase
        FirebaseApp.initializeApp(this)
        firestore = FirebaseFirestore.getInstance()
        
        // Carregar modelo TensorFlow Lite
        loadModel()
        
        // Iniciar câmera
        startCamera()
    }
    
    private fun loadModel() {
        try {
            val modelFile = File(assets, "pet_behavior_model.tflite")
            tfliteInterpreter = Interpreter(modelFile)
        } catch (e: Exception) {
            Log.e("VIGIA_PET", "Erro ao carregar modelo: ${e.message}")
        }
    }
    
    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            cameraProvider = cameraProviderFuture.get()
            
            val preview = Preview.Builder().build()
            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
            
            // Analisador de imagens
            imageAnalyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
            
            imageAnalyzer.setAnalyzer(Executors.newSingleThreadExecutor()) { imageProxy ->
                processImage(imageProxy)
                imageProxy.close()
            }
            
            val viewFinder = findViewById<PreviewView>(R.id.viewFinder)
            preview.setSurfaceProvider(viewFinder.surfaceProvider)
            
            cameraProvider.bindToLifecycle(
                this,
                cameraSelector,
                preview,
                imageAnalyzer
            )
        }, ContextCompat.getMainExecutor(this))
    }
    
    private fun processImage(imageProxy: ImageProxy) {
        // Converter imagem para Bitmap
        val bitmap = imageProxy.toBitmap()
        val resizedBitmap = Bitmap.createScaledBitmap(bitmap, 224, 224, true)
        
        // Pré-processar para o modelo
        val inputArray = preprocessImage(resizedBitmap)
        
        // Rodar inferência
        val outputArray = Array(1) { FloatArray(3) }
        tfliteInterpreter.run(inputArray, outputArray)
        
        // Obter resultado
        val predictions = outputArray[0]
        val behavior = getPredictedBehavior(predictions)
        
        runOnUiThread {
            updateUI(behavior)
            if (isBehaviorChanged(behavior)) {
                sendAlertToOwner(behavior)
            }
            saveBehaviorToFirestore(behavior)
        }
    }
    
    private fun preprocessImage(bitmap: Bitmap): Array<Array<Array<FloatArray>>> {
        // Normalizar para [0,1]
        val inputArray = Array(1) { Array(224) { Array(224) { FloatArray(3) } } }
        for (x in 0 until 224) {
            for (y in 0 until 224) {
                val pixel = bitmap.getPixel(x, y)
                inputArray[0][x][y][0] = ((pixel shr 16 and 0xFF) / 255.0f)
                inputArray[0][x][y][1] = ((pixel shr 8 and 0xFF) / 255.0f)
                inputArray[0][x][y][2] = ((pixel and 0xFF) / 255.0f)
            }
        }
        return inputArray
    }
    
    private fun getPredictedBehavior(predictions: FloatArray): String {
        val maxIndex = predictions.indices.maxByOrNull { predictions[it] } ?: 0
        return when (maxIndex) {
            0 -> "dormindo"
            1 -> "comendo"
            2 -> "agitado"
            else -> "desconhecido"
        }
    }
    
    private fun updateUI(behavior: String) {
        val statusView = findViewById<TextView>(R.id.statusText)
        val emojiView = findViewById<TextView>(R.id.emojiView)
        
        when (behavior) {
            "dormindo" -> {
                statusView.text = "😴 Dormindo"
                emojiView.text = "😴"
            }
            "comendo" -> {
                statusView.text = "🍖 Comendo"
                emojiView.text = "🍖"
            }
            "agitado" -> {
                statusView.text = "🐕 Agitado"
                emojiView.text = "🐕"
            }
        }
    }
    
    private fun sendAlertToOwner(behavior: String) {
        val alertMessage = when (behavior) {
            "dormindo" -> "Seu pet está dormindo agora 💤"
            "comendo" -> "Seu pet está se alimentando 🍖"
            "agitado" -> "Seu pet está agitado! 🐕"
            else -> "Comportamento detectado"
        }
        
        // Enviar notificação via Firebase Cloud Messaging
        val notification = NotificationCompat.Builder(this, "pet_channel")
            .setContentTitle("🐾 VIGIA PET")
            .setContentText(alertMessage)
            .setSmallIcon(R.drawable.ic_notification)
            .setAutoCancel(true)
            .build()
        
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(1001, notification)
        
        // Salvar no Firestore
        val data = hashMapOf(
            "timestamp" to System.currentTimeMillis(),
            "behavior" to behavior,
            "message" to alertMessage,
            "read" to false
        )
        
        firestore.collection("alerts")
            .add(data)
            .addOnSuccessListener {
                Log.d("VIGIA_PET", "Alerta salvo com sucesso")
            }
    }
    
    private fun saveBehaviorToFirestore(behavior: String) {
        val data = hashMapOf(
            "timestamp" to System.currentTimeMillis(),
            "behavior" to behavior
        )
        
        firestore.collection("pets")
            .document("pet_id_aqui")
            .collection("behaviors")
            .add(data)
    }
}