const express = require("express");
const sharp = require("sharp");
const multer = require("multer");
const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const ViteExpress = require("vite-express");

console.log("process.env.NODE_ENV", process.env.NODE_ENV);

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb" }));

// Set up AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const formatDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(now.getDate()).padStart(2, "0")}-${String(
    now.getHours(),
  ).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(
    now.getSeconds(),
  ).padStart(2, "0")}`;
};

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const formattedDate = formatDate();
    cb(null, formattedDate + path.extname(file.originalname)); // Append the file extension
  },
});
const upload = multer({ storage: storage });

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const smallSize = 800;
const largeSize = 2000;

const resizeImage = (inputPath, outputDir, callback) => {
  const fileName = path.basename(inputPath, path.extname(inputPath));

  // Define output paths
  const smallPath = path.join(outputDir, `${fileName}-${smallSize}.jpg`);
  const largePath = path.join(outputDir, `${fileName}-${largeSize}.jpg`);

  // Resize to small (800px)
  sharp(inputPath)
    .resize(smallSize, smallSize, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .toFile(smallPath, (err) => {
      if (err) {
        return callback(err);
      }

      // Resize to large (2000px)
      sharp(inputPath)
        .resize(largeSize, largeSize, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .toFile(largePath, (err) => {
          if (err) {
            return callback(err);
          }

          callback(null, {
            small: smallPath,
            large: largePath,
          });
        });
    });
};

const uploadToS3 = (filePath, key, contentType, callback) => {
  const fileContent = fs.readFileSync(filePath);

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
  };

  s3.upload(params, (err, data) => {
    if (err) {
      return callback(err);
    }
    callback(null, data.Location);
  });
};

app.post("/api/upload/image", upload.single("image"), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send("No file uploaded.");
  }

  const outputDir = "uploads/";
  resizeImage(file.path, outputDir, (err, resizedImages) => {
    if (err) {
      console.error("Error resizing image:", err);
      return res.status(500).send("Error resizing image.");
    }

    const { small, large } = resizedImages;
    const fileName = path.basename(file.path, path.extname(file.path));

    // Upload large version
    uploadToS3(large, `${fileName}-${largeSize}.jpg`, "image/jpeg", (err, largeLocation) => {
      if (err) {
        console.error("Error uploading large image:", err);
        return res.status(500).send("Error uploading large image.");
      }

      // Upload small version
      uploadToS3(
        small,
        `${fileName}-${smallSize}.jpg`,
        "image/jpeg",
        (err, smallLocation) => {
          if (err) {
            console.error("Error uploading small image:", err);
            return res.status(500).send("Error uploading small image.");
          }

          // Clean up local files
          fs.unlinkSync(file.path);
          fs.unlinkSync(small);
          fs.unlinkSync(large);

          res.send({
            message: "Files uploaded successfully",
            smallImageUrl: smallLocation,
            largeImageUrl: largeLocation,
          });
        },
      );
    });
  });
});

app.post("/api/upload/video", upload.single("video"), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send("No file uploaded.");
  }

  const fileName = path.basename(file.path, path.extname(file.path));
  const key = `${fileName}.mp4`;

  uploadToS3(file.path, key, "video/mp4", (err, location) => {
    if (err) {
      console.error("Error uploading video:", err);
      return res.status(500).send("Error uploading video.");
    }

    // Clean up local file
    fs.unlinkSync(file.path);

    res.send({
      message: "Video uploaded successfully",
      videoUrl: location,
    });
  });
});

app.post("/api/upload/audio", upload.single("audio"), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send("No file uploaded.");
  }

  const fileName = path.basename(file.path, path.extname(file.path));
  const key = `${fileName}.mp3`;

  uploadToS3(file.path, key, "audio/mpeg", (err, location) => {
    if (err) {
      console.error("Error uploading audio:", err);
      return res.status(500).send("Error uploading audio.");
    }

    // Clean up local file
    fs.unlinkSync(file.path);

    res.send({
      message: "Audio uploaded successfully",
      audioUrl: location,
    });
  });
});

app.get("/api/list-objects", async (req, res) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
  };

  try {
    const data = await s3.listObjectsV2(params).promise();
    const sortedData = data.Contents.sort(
      (a, b) => new Date(b.LastModified) - new Date(a.LastModified),
    );
    res.json(sortedData);
  } catch (err) {
    console.error("Error listing objects:", err);
    res.status(500).send("Error listing objects.");
  }
});

const port = process.env.NODE_ENV === "production" ? 5050 : 3000;
ViteExpress.config({
  inlineViteConfig: {
    base: "/",
  },
});
ViteExpress.listen(app, port, () => console.log("Server is listening..."));
