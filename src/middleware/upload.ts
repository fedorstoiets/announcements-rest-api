import multer from "multer";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { v2 as cloudinary } from "cloudinary";

const uploadDirectory = path.resolve("uploads");
mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDirectory);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname) || ".bin";
    callback(
      null,
      `${Date.now()}-${Math.round(Math.random() * 1_000_000_000)}${extension}`,
    );
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, callback) => {
  if (!file.mimetype.startsWith("image/")) {
    callback(new Error("Only image files are allowed"));
    return;
  }

  callback(null, true);
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter,
});

function configureCloudinary(): void {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary environment variables are not configured");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

export async function deleteLocalUpload(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code !== "ENOENT") {
      throw error;
    }
  }
}

export async function uploadImageToCloudinary(
  filePath: string,
): Promise<string> {
  configureCloudinary();

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "announcements",
      resource_type: "image",
    });

    return result.secure_url;
  } finally {
    await deleteLocalUpload(filePath);
  }
}

export default upload;