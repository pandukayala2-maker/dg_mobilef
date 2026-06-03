const fs = require('fs');
const path = require('path');

console.log('--- Starting build patches using Node.js ---');

// 1. Patch gradle-wrapper.properties
const wrapperPath = path.join(__dirname, 'android', 'gradle', 'wrapper', 'gradle-wrapper.properties');
if (fs.existsSync(wrapperPath)) {
  let content = fs.readFileSync(wrapperPath, 'utf8');
  if (content.includes('gradle-9.0.0-bin.zip')) {
    content = content.replace('gradle-9.0.0-bin.zip', 'gradle-8.13-bin.zip');
    fs.writeFileSync(wrapperPath, content, 'utf8');
    console.log('[SUCCESS] Patched gradle-wrapper.properties to version 8.13');
  } else {
    console.log('[INFO] gradle-wrapper.properties is already updated or does not contain gradle-9.0.0-bin.zip');
  }
} else {
  console.error('[ERROR] gradle-wrapper.properties not found at: ' + wrapperPath);
}

// 2. Patch gradle.properties
const gradlePropsPath = path.join(__dirname, 'android', 'gradle.properties');
if (fs.existsSync(gradlePropsPath)) {
  let content = fs.readFileSync(gradlePropsPath, 'utf8');
  if (content.includes('org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m')) {
    content = content.replace(
      'org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m',
      'org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=768m'
    );
    fs.writeFileSync(gradlePropsPath, content, 'utf8');
    console.log('[SUCCESS] Patched gradle.properties with 2GB heap and 768MB metaspace');
  } else {
    console.log('[INFO] gradle.properties already patched or target line not found');
  }
} else {
  console.error('[ERROR] gradle.properties not found at: ' + gradlePropsPath);
}

// 3. Patch build.gradle to add lintOptions
const buildGradlePath = path.join(__dirname, 'android', 'app', 'build.gradle');
if (fs.existsSync(buildGradlePath)) {
  let content = fs.readFileSync(buildGradlePath, 'utf8');
  const target = `ignoreAssetsPattern '!.svn:!.git:!.ds_store:!*.scc:!CVS:!thumbs.db:!picasa.ini:!*~'`;
  const index = content.indexOf(target);
  if (index !== -1) {
    if (!content.includes('lintOptions')) {
      const nextBraceIndex = content.indexOf('}', index + target.length);
      if (nextBraceIndex !== -1) {
        const insertPos = nextBraceIndex + 1;
        const lintOptionsStr = `\n    lintOptions {\n        checkReleaseBuilds false\n        abortOnError false\n    }`;
        content = content.slice(0, insertPos) + lintOptionsStr + content.slice(insertPos);
        fs.writeFileSync(buildGradlePath, content, 'utf8');
        console.log('[SUCCESS] Patched build.gradle to include lintOptions (abortOnError false)');
      } else {
        console.error('[ERROR] Could not find closing brace for androidResources block in build.gradle');
      }
    } else {
      console.log('[INFO] build.gradle already contains lintOptions');
    }
  } else {
    console.error('[ERROR] target ignoreAssetsPattern not found in build.gradle');
  }
} else {
  console.error('[ERROR] build.gradle not found at: ' + buildGradlePath);
}

// 4. Copy upload-keystore.jks to android/app/
const sourceKeystore = path.join(__dirname, 'upload-keystore.jks');
const destKeystore = path.join(__dirname, 'android', 'app', 'upload-keystore.jks');
if (fs.existsSync(sourceKeystore)) {
  fs.copyFileSync(sourceKeystore, destKeystore);
  console.log('[SUCCESS] Copied upload-keystore.jks to android/app/');
} else {
  console.warn('[WARNING] upload-keystore.jks not found in project root');
}

// 5. Inject release signing configuration in build.gradle
if (fs.existsSync(buildGradlePath)) {
  let content = fs.readFileSync(buildGradlePath, 'utf8');
  
  const debugConfigTarget = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;
  
  if (content.includes(debugConfigTarget)) {
    const updatedConfigs = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            storeFile file('upload-keystore.jks')
            storePassword 'android123'
            keyAlias 'upload'
            keyPassword 'android123'
        }
    }`;
    content = content.replace(debugConfigTarget, updatedConfigs);
    console.log('[SUCCESS] Added release signingConfig to build.gradle');
  }

  const releaseBuildTypeTarget = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

  if (content.includes(releaseBuildTypeTarget)) {
    const updatedReleaseBuildType = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.release`;
    content = content.replace(releaseBuildTypeTarget, updatedReleaseBuildType);
    console.log('[SUCCESS] Set release buildType to use release signingConfig in build.gradle');
  }
  
  fs.writeFileSync(buildGradlePath, content, 'utf8');
}

console.log('--- Finished build patches ---');
