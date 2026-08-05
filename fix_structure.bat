# Criar a pasta scripts se não existir
mkdir scripts 2>nul

# Criar o arquivo fix_structure.bat
echo @echo off > scripts\fix_structure.bat
echo echo ======================================== >> scripts\fix_structure.bat
echo echo    🔧 REESTRUTURANDO VIGIA PET >> scripts\fix_structure.bat
echo echo ======================================== >> scripts\fix_structure.bat
echo echo. >> scripts\fix_structure.bat
echo echo 📁 Criando pastas principais... >> scripts\fix_structure.bat
echo mkdir android 2^>nul >> scripts\fix_structure.bat
echo mkdir android\app 2^>nul >> scripts\fix_structure.bat
echo mkdir android\app\src 2^>nul >> scripts\fix_structure.bat
echo mkdir android\app\src\main 2^>nul >> scripts\fix_structure.bat
echo mkdir android\app\src\main\java\com\vigiapet 2^>nul >> scripts\fix_structure.bat
echo mkdir android\app\src\main\res\layout 2^>nul >> scripts\fix_structure.bat
echo mkdir backend 2^>nul >> scripts\fix_structure.bat
echo mkdir ml 2^>nul >> scripts\fix_structure.bat
echo mkdir ml\dataset 2^>nul >> scripts\fix_structure.bat
echo mkdir ml\models 2^>nul >> scripts\fix_structure.bat
echo mkdir ml\training 2^>nul >> scripts\fix_structure.bat
echo mkdir frontend\css 2^>nul >> scripts\fix_structure.bat
echo mkdir frontend\js 2^>nul >> scripts\fix_structure.bat
echo mkdir frontend\assets 2^>nul >> scripts\fix_structure.bat
echo echo. >> scripts\fix_structure.bat
echo echo 📦 Movendo arquivos... >> scripts\fix_structure.bat
echo if exist andoird.kt move andoird.kt android\app\src\main\java\com\vigiapet\MainActivity.kt 2^>nul >> scripts\fix_structure.bat
echo if exist index.html move index.html frontend\ 2^>nul >> scripts\fix_structure.bat
echo if exist javascript.js move javascript.js frontend\js\app.js 2^>nul >> scripts\fix_structure.bat
echo if exist model.js move model.js frontend\js\models.js 2^>nul >> scripts\fix_structure.bat
echo if exist training.py move training.py ml\training\ 2^>nul >> scripts\fix_structure.bat
echo echo. >> scripts\fix_structure.bat
echo echo ✅ Estrutura corrigida! >> scripts\fix_structure.bat
echo echo. >> scripts\fix_structure.bat
echo echo 📂 Nova estrutura: >> scripts\fix_structure.bat
echo tree /f >> scripts\fix_structure.bat
echo pause >> scripts\fix_structure.bat