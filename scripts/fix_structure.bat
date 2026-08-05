@echo off 
echo ======================================== 
echo    ?? REESTRUTURANDO VIGIA PET 
echo ======================================== 
echo. 
echo ?? Criando pastas principais... 
mkdir android 2>nul 
mkdir android\app 2>nul 
mkdir android\app\src 2>nul 
mkdir android\app\src\main 2>nul 
mkdir android\app\src\main\java\com\vigiapet 2>nul 
mkdir android\app\src\main\res\layout 2>nul 
mkdir backend 2>nul 
mkdir ml 2>nul 
mkdir ml\dataset 2>nul 
mkdir ml\models 2>nul 
mkdir ml\training 2>nul 
mkdir frontend\css 2>nul 
mkdir frontend\js 2>nul 
mkdir frontend\assets 2>nul 
echo. 
echo ?? Movendo arquivos... 
if exist andoird.kt move andoird.kt android\app\src\main\java\com\vigiapet\MainActivity.kt 2>nul 
if exist index.html move index.html frontend\ 2>nul 
if exist javascript.js move javascript.js frontend\js\app.js 2>nul 
if exist model.js move model.js frontend\js\models.js 2>nul 
if exist training.py move training.py ml\training\ 2>nul 
echo. 
echo ? Estrutura corrigida! 
echo. 
echo ?? Nova estrutura: 
tree /f 
