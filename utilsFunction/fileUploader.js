const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const { supabase } = require("./supabaseConfig");
const fs = require("fs");
const path = require("path");

const uploadFileToSupabase = async ({ buffer, originalname, mimetype }) => {
  const bucketName = "dostana"; // Hardcoded Supabase bucket name
  try {
    const isImage = mimetype.startsWith("image/");
    const isVideo = mimetype.startsWith("video/");
    let processedBuffer;
    let filePath;

    if (isImage) {
      // Process image using Sharp
      processedBuffer = await sharp(buffer)
        .resize({ width: 800, withoutEnlargement: true }) // Resize to 800px width
        .toFormat("avif", { quality: 80, force: true, alphaQuality: 100, lossless: true, effort: 4 }) // Convert to AVIF format
        .toBuffer();

      filePath = `${Date.now()}-${originalname.split(".").slice(0, -1).join(".")}.avif`;
    } else if (isVideo) {
      // Temporary paths for input and output files
      const tempInputPath = path.join(__dirname, `temp-${Date.now()}-${originalname}`);
      const tempOutputPath = path.join(__dirname, `${Date.now()}-${originalname.split(".").slice(0, -1).join(".")}.mp4`);

      // Write the buffer to a temporary file
      fs.writeFileSync(tempInputPath, buffer);

      // Process video using fluent-ffmpeg
      await new Promise((resolve, reject) => {
        ffmpeg(tempInputPath)
          .outputOptions("-vf", "scale=1280:-2") // Resize to 1280px width, maintain aspect ratio
          .outputOptions("-b:v", "1M") // Limit bitrate to 1Mbps
          .outputOptions("-c:v", "libx264") // Use H.264 codec
          .on("end", () => {
            resolve();
          })
          .on("error", (err) => {
            reject(new Error(`FFmpeg processing error: ${err.message}`));
          })
          .save(tempOutputPath); // Save processed file
      });

      // Read processed file into a buffer
      processedBuffer = fs.readFileSync(tempOutputPath);

      filePath = path.basename(tempOutputPath);

      // Clean up temporary files
      fs.unlinkSync(tempInputPath);
      fs.unlinkSync(tempOutputPath);
    } else {
      throw new Error("Unsupported file type");
    }

    // Upload the processed file to Supabase
    const { error } = await supabase.storage.from(bucketName).upload(filePath, processedBuffer, {
      contentType: isImage ? "image/avif" : "video/mp4",
    });

    if (error) throw error;

    // Return the public URL for the uploaded file
    const fileUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filePath}`;
    return { isError: false, fileUrl };
  } catch (error) {
    console.error("Upload error:", error.message);
    return { isError: true, message: error.message };
  }
};

module.exports = { uploadFileToSupabase };
