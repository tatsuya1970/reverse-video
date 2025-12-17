const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const port = process.env.PORT || 3000;

// uploadsディレクトリが存在しない場合は作成
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// アップロード先（テンポラリ）
const upload = multer({ dest: uploadsDir });

// 静的ファイル配信（index.html, app.js など）
app.use(express.static(__dirname));

// 逆回転API
app.post('/api/reverse', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('動画ファイルが送信されていません。');
  }

  const inputPath = req.file.path;
  const outputPath = inputPath + '_reversed.mp4';

  // ffmpeg コマンド: 映像と音声を逆再生
  const ffmpeg = spawn('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-vf', 'reverse',
    '-af', 'areverse',
    outputPath,
  ]);

  ffmpeg.stderr.on('data', (data) => {
    console.error(data.toString());
  });

  ffmpeg.on('close', (code) => {
    if (code !== 0) {
      console.error('ffmpeg failed with code', code);
      fs.unlink(inputPath, () => {});
      return res.status(500).send('ffmpeg の実行に失敗しました。');
    }

    // 生成されたファイルを返す
    res.setHeader('Content-Type', 'video/mp4');

    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);

    stream.on('close', () => {
      fs.unlink(inputPath, () => {});
      fs.unlink(outputPath, () => {});
    });
  });
});

app.listen(port, () => {
  console.log(`Reverse video server listening at http://localhost:${port}`);
});


