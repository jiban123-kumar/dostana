// mongodbFileHandler.js

const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const { GridFSBucket } = require("mongodb");
const mongoose = require("mongoose");

const uploadFileToMongoDB = async ({ buffer, originalname, mimetype }) => {
  try {
    const isImage = mimetype.startsWith("image/");
    const isVideo = mimetype.startsWith("video/");
    let processedBuffer;
    let filename;

    if (isImage) {
      // Process image: resize and convert to AVIF format
      processedBuffer = await sharp(buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .toFormat("avif", {
          quality: 80,
          force: true,
          alphaQuality: 100,
          lossless: true,
          effort: 4,
        })
        .toBuffer();

      filename = `${Date.now()}-${originalname.split(".").slice(0, -1).join(".")}.avif`;
    } else if (isVideo) {
      // Process video: convert using FFmpeg
      const tempInputPath = path.join(__dirname, `temp-${Date.now()}-${originalname}`);
      const tempOutputPath = path.join(__dirname, `${Date.now()}-${originalname.split(".").slice(0, -1).join(".")}.mp4`);

      fs.writeFileSync(tempInputPath, buffer);

      await new Promise((resolve, reject) => {
        ffmpeg(tempInputPath)
          .outputOptions("-vf", "scale=1280:-2") // Resize to 1280px width, maintain aspect ratio
          .outputOptions("-b:v", "1M") // Limit bitrate to 1Mbps
          .outputOptions("-c:v", "libx264") // Use H.264 codec
          .on("end", resolve)
          .on("error", (err) => reject(new Error(`FFmpeg processing error: ${err.message}`)))
          .save(tempOutputPath);
      });

      processedBuffer = fs.readFileSync(tempOutputPath);
      filename = path.basename(tempOutputPath);

      // Clean up temporary files
      fs.unlinkSync(tempInputPath);
      fs.unlinkSync(tempOutputPath);
    } else {
      throw new Error("Unsupported file type");
    }

    // Access the active MongoDB database from Mongoose
    const db = mongoose.connection.db;
    const bucket = new GridFSBucket(db, { bucketName: "files" });

    // Upload the processed buffer to GridFS
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: isImage ? "image/avif" : "video/mp4",
    });
    uploadStream.end(processedBuffer);

    const fileId = await new Promise((resolve, reject) => {
      uploadStream.on("finish", () => resolve(uploadStream.id));
      uploadStream.on("error", reject);
    });

    // Construct a URL to access the file.
    // Note: You need a route (e.g. GET /files/:id) to serve the file from GridFS.
    const fileUrl = `${process.env.BASE_URL}/files/${fileId}`;
    return { isError: false, fileUrl };
  } catch (error) {
    console.error("Upload error:", error.message);
    return { isError: true, message: error.message };
  }
};

const removeFileFromMongoDB = async (fileUrl) => {
  try {
    // Extract fileId from the URL
    const parts = fileUrl.split("/");
    const fileId = parts[parts.length - 1];

    const db = mongoose.connection.db;
    const bucket = new GridFSBucket(db, { bucketName: "files" });

    await bucket.delete(new mongoose.Types.ObjectId(String(fileId)));
    return { isError: false };
  } catch (error) {
    console.error("Remove error:", error.message);
    return { isError: true, message: error.message };
  }
};

module.exports = {
  uploadFileToMongoDB,
  removeFileFromMongoDB,
};
