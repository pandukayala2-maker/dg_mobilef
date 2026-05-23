const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 8082;
const apkPath = path.join(__dirname, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

// Find local IP address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIp();

if (!fs.existsSync(apkPath)) {
  console.error("Error: app-debug.apk not found at " + apkPath + ". Please build the app first.");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  if (req.url === '/app-debug.apk' || req.url === '/') {
    try {
      const stat = fs.statSync(apkPath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': stat.size,
        'Content-Disposition': 'attachment; filename=app-debug.apk'
      });
      const readStream = fs.createReadStream(apkPath);
      readStream.pipe(res);
      console.log(`[${new Date().toLocaleTimeString()}] Download started by device.`);
    } catch (err) {
      console.error("Error serving file:", err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  ANSOFTT DC - Wireless APK Downloader`);
  console.log(`======================================================\n`);
  console.log(`Make sure your phone is connected to the SAME Wi-Fi network.\n`);
  console.log(`Open this link in your phone's browser to download the APK:`);
  console.log(`\x1b[36mhttp://${localIp}:${PORT}/app-debug.apk\x1b[0m\n`);
  console.log(`Once downloaded, install the APK on your phone.`);
  console.log(`Press Ctrl+C to stop this server.\n`);
});
