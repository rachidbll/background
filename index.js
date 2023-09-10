const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const { createCanvas, Image } = require('canvas');
const bodyPix = require('@tensorflow-models/body-pix');
const tf = require('@tensorflow/tfjs-node');
const multer = require('multer');
const fs = require('fs');

app.use(express.static('public'));

// Set up Multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Load the BodyPix model
let net;
bodyPix.load().then((model) => {
  net = model;
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.post('/remove', upload.single('image'), async (req, res) => {
  if (!net) {
    res.status(500).send('BodyPix model not loaded');
    return;
  }

  const imageBuffer = req.file.buffer;
  const img = new Image();
  img.src = imageBuffer;

  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const input = tf.browser.fromPixels(canvas);
  const segmentation = await net.segmentPerson(input);

  const output = createCanvas(img.width, img.height);
  const outputCtx = output.getContext('2d');
  outputCtx.drawImage(img, 0, 0);

  const mask = segmentation.toMask(2); // 2 corresponds to 'person' class
  const imageData = outputCtx.getImageData(0, 0, img.width, img.height);

  for (let i = 0; i < imageData.data.length; i += 4) {
    if (mask.data[i / 4] === 0) {
      imageData.data[i + 3] = 0; // Set the alpha channel to 0 (transparent)
    }
  }

  outputCtx.putImageData(imageData, 0, 0);

  const outputBuffer = output.toBuffer('image/png');

  fs.writeFileSync('public/output.png', outputBuffer);

  res.sendFile(__dirname + '/public/output.png');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
