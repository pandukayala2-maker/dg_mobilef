@echo off
setlocal
set CMAKE_BUILD_PARALLEL_LEVEL=2

:: Set Environment Variables for the build session (fallback to standard paths if not pre-defined)
if not defined JAVA_HOME (
    if exist "C:\Program Files\Android\Android Studio\jbr" (
        set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
    ) else if exist "C:\Program Files\Java\jdk-17" (
        set "JAVA_HOME=C:\Program Files\Java\jdk-17"
    )
)

if not defined ANDROID_HOME (
    if exist "%LOCALAPPDATA%\Android\Sdk" (
        set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
    ) else if exist "%USERPROFILE%\AppData\Local\Android\Sdk" (
        set "ANDROID_HOME=%USERPROFILE%\AppData\Local\Android\Sdk"
    )
)

if defined JAVA_HOME set "PATH=%JAVA_HOME%\bin;%PATH%"
if defined ANDROID_HOME set "PATH=%ANDROID_HOME%\platform-tools;%PATH%"

echo ==========================================
echo    ANSOFTT DC - Clean APK Build (Offline)
echo ==========================================
echo.
echo [1/2] Preparing project (Full Clean)...
if exist android (
    echo Removing old android folder...
    rmdir /s /q android
)
call npx expo prebuild --platform android --no-install

echo.
echo [1.5/2] Fixing Gradle version and Memory (fixing OutOfMemory: Metaspace)...
call node patch_build.js

echo.
echo [2/2] Compiling APK (this may take a few minutes)...
cd android
call gradlew.bat clean
call gradlew.bat assembleRelease --no-daemon --max-workers=2 -Dorg.gradle.parallel=false

echo.
if exist "app\build\outputs\apk\release\app-release.apk" (
    echo [SUCCESS] APK generated!
    echo Location: %cd%\app\build\outputs\apk\release\app-release.apk
    echo.
    echo Copying APK to project root...
    copy "app\build\outputs\apk\release\app-release.apk" "..\dgmobile_release_v1.1.3.apk"
) else (
    echo [ERROR] Build failed. Please check the logs above for errors.
)

pause
