const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const bodyPix = require('@tensorflow-models/body-pix');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload());

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/upload', async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send('No files were uploaded.');
  }

  const uploadedFile = req.files.uploadedFile;
  const outputPath = path.join(__dirname, 'public', 'output.png');

  uploadedFile.mv(path.join(__dirname, 'public', uploadedFile.name), async (err) => {
    if (err) {
      return res.status(500).send(err);
    }

    try {
      const image = await loadImage(uploadedFile.name);
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, image.width, image.height);

      const net = await bodyPix.load();
      const segmentation = await net.segmentPerson(canvas);

      const newCanvas = createCanvas(image.width, image.height);
      const newCtx = newCanvas.getContext('2d');
      newCtx.drawImage(image, 0, 0, image.width, image.height);

      segmentation.data.forEach((segment, index) => {
        if (segment === 0) {
          newCtx.fillStyle = 'rgba(0, 0, 0, 0)';
          newCtx.fillRect(index % image.width, Math.floor(index / image.width), 1, 1);
        }
      });

      const stream = fs.createWriteStream(outputPath);
      stream.on('close', () => {
        console.log('Background removed and saved to', outputPath);
        res.sendFile(path.join(__dirname, 'public', 'output.png'));
      });

      newCanvas.createPNGStream().pipe(stream);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error processing image.');
    }
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
