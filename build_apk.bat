@echo off
setlocal

:: Set Environment Variables for the build session
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

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
powershell -Command "(Get-Content android/gradle/wrapper/gradle-wrapper.properties) -replace 'gradle-9.0.0-bin.zip', 'gradle-8.13-bin.zip' | Set-Content android/gradle/wrapper/gradle-wrapper.properties"
powershell -Command "(Get-Content android/gradle.properties) -replace 'org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m', 'org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m' | Set-Content android/gradle.properties"
powershell -Command "(Get-Content android/app/build.gradle) -replace 'ignoreAssetsPattern ''!.svn:!.git:!.ds_store:!*.scc:!CVS:!thumbs.db:!picasa.ini:!*~''', 'ignoreAssetsPattern ''!.svn:!.git:!.ds_store:!*.scc:!CVS:!thumbs.db:!picasa.ini:!*~'''; } lintOptions { checkReleaseBuilds false; abortOnError false; }' | Set-Content android/app/build.gradle"

echo.
echo [2/2] Compiling APK (this may take a few minutes)...
cd android
call gradlew.bat clean
call gradlew.bat assembleRelease

echo.
if exist "app\build\outputs\apk\release\app-release.apk" (
    echo [SUCCESS] APK generated!
    echo Location: %cd%\app\build\outputs\apk\release\app-release.apk
    echo.
    echo Copying APK to project root...
    copy "app\build\outputs\apk\release\app-release.apk" "..\dgmobile_release_v1.0.6.apk"
) else (
    echo [ERROR] Build failed. Please check the logs above for errors.
)

pause
