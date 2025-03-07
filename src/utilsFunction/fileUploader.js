const sharp = require("sharp");
const { supabase } = require("./supabaseConfig");

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
        .toFormat("jpeg", { quality: 80, force: true, alphaQuality: 100, lossless: true, effort: 4 })
        .toBuffer();
      // Rename image file to have a new extension (e.g., .avif)
      filePath = `${Date.now()}-${originalname.split(".").slice(0, -1).join(".")}.avif`;
    } else if (isVideo) {
      // For video files, bypass processing and upload the original buffer
      processedBuffer = buffer;
      filePath = `${Date.now()}-${originalname}`;
    } else {
      throw new Error("Unsupported file type");
    }

    // Upload the file to Supabase Storage
    const { error } = await supabase.storage.from(bucketName).upload(filePath, processedBuffer, {
      contentType: isImage ? "image/avif" : mimetype,
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
