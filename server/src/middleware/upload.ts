import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

const farmerUploadDir = path.resolve(process.cwd(), 'uploads/farmers');
if (!fs.existsSync(farmerUploadDir)) {
  fs.mkdirSync(farmerUploadDir, { recursive: true });
}

const avatarUploadDir = path.resolve(process.cwd(), 'uploads/avatars');
if (!fs.existsSync(avatarUploadDir)) {
  fs.mkdirSync(avatarUploadDir, { recursive: true });
}

const farmerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, farmerUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png'].includes(ext) ? ext : '.jpg';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `farmer-photo-${uniqueSuffix}${safeExt}`);
  },
});

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, avatarUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `avatar-${uniqueSuffix}${safeExt}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];

  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, JPEG, PNG, and WebP images are allowed.'));
  }
};

export const uploadFarmerPhoto = multer({
  storage: farmerStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
  fileFilter,
});

export const uploadUserAvatar = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
  fileFilter,
});
