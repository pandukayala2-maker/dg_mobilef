const { Jimp } = require("jimp");
const path = require("path");

async function padImage() {
  const inputPath = path.resolve(__dirname, "../assets/ansoftt_logo.png");
  const outputPath = path.resolve(__dirname, "../assets/ansoftt_logo_padded.png");

  console.log("Loading image from:", inputPath);
  try {
    const original = await Jimp.read(inputPath);
    const width = original.bitmap.width;
    const height = original.bitmap.height;

    // We want the logo to be about 60% of the total size to ensure it fits in the adaptive icon mask
    const targetSizeW = Math.round(width * 0.6);
    const targetSizeH = Math.round(height * 0.6);

    console.log(`Original size: ${width}x${height}`);
    console.log(`Target inner size: ${targetSizeW}x${targetSizeH}`);

    original.resize({ w: targetSizeW, h: targetSizeH });

    // Create a new blank transparent image of the original size
    const padded = new Jimp({ width, height, color: 0x00000000 }); // Transparent background

    // Center the original image on the new blank image
    const x = Math.round((width - targetSizeW) / 2);
    const y = Math.round((height - targetSizeH) / 2);

    padded.composite(original, x, y);

    await padded.write(outputPath);
    console.log("Successfully created padded image at:", outputPath);
  } catch (err) {
    console.error("Error processing image:", err);
  }
}

padImage();
