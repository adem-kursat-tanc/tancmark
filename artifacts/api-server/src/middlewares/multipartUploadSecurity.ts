import multer from "multer";
import type { RequestHandler } from "express";

export interface MultipartUploadProfile {
  readonly fileSize: number;
  readonly maxTextFields: number;
  readonly fieldSize: number;
}

export const MULTIPART_UPLOAD_PROFILES = Object.freeze({
  aegisImage: { fileSize: 10 * 1024 * 1024, maxTextFields: 0, fieldSize: 1 },
  audioEncode: { fileSize: 64 * 1024 * 1024, maxTextFields: 3, fieldSize: 4 * 1024 },
  audioAnalyze: { fileSize: 64 * 1024 * 1024, maxTextFields: 5, fieldSize: 4 * 1024 },
  audioVaultPreview: { fileSize: 64 * 1024 * 1024, maxTextFields: 3, fieldSize: 4 * 1024 },
  videoMiniTest: { fileSize: 64 * 1024 * 1024, maxTextFields: 6, fieldSize: 4 * 1024 },
  videoEncode: { fileSize: 64 * 1024 * 1024, maxTextFields: 6, fieldSize: 4 * 1024 },
  videoDecode: { fileSize: 64 * 1024 * 1024, maxTextFields: 3, fieldSize: 4 * 1024 },
  videoPrivateExact: { fileSize: 128 * 1024 * 1024, maxTextFields: 5, fieldSize: 4 * 1024 * 1024 },
  visualLab: { fileSize: 16 * 1024 * 1024, maxTextFields: 8, fieldSize: 4 * 1024 },
} satisfies Record<string, MultipartUploadProfile>);

type MulterLimitsWithNesting = NonNullable<multer.Options["limits"]> & {
  fieldNestingDepth: number;
};

export function createSecureMemoryUpload(profile: MultipartUploadProfile): multer.Multer {
  const limits: MulterLimitsWithNesting = {
    fileSize: profile.fileSize,
    files: 1,
    fields: profile.maxTextFields,
    // Busboy emits partsLimit when the counter reaches the configured value,
    // so one sentinel slot is required to accept exactly file + max fields.
    parts: profile.maxTextFields + 2,
    fieldNameSize: 32,
    fieldSize: profile.fieldSize,
    headerPairs: 8,
    // Every accepted TancMark multipart contract uses flat field names.
    fieldNestingDepth: 0,
  };
  const upload = multer({
    storage: multer.memoryStorage(),
    limits,
    preservePath: false,
  });
  const multerSingle = upload.single.bind(upload);
  upload.single = (expectedFileField: string): RequestHandler => {
    const parse = multerSingle(expectedFileField);
    return (req, res, next): void => {
      parse(req, res, (error?: unknown) => {
        if (error) {
          next(error);
          return;
        }
        const fieldNames = Object.keys(req.body ?? {});
        if (fieldNames.some((name) => name.length === 0 || name.length > 32 || /[\[\]]/.test(name))) {
          next(new multer.MulterError("LIMIT_FIELD_KEY"));
          return;
        }
        next();
      });
    };
  };
  return upload;
}

export function publicMultipartUploadError(error: unknown): { status: 400 | 413; error: string } | null {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE" || error.code === "LIMIT_FIELD_VALUE") {
      return { status: 413, error: "payload_too_large" };
    }
    return { status: 400, error: "invalid_multipart" };
  }
  if (error instanceof Error && /^(Unexpected end of form|Malformed part header|Unexpected end of file)$/i.test(error.message)) {
    return { status: 400, error: "invalid_multipart" };
  }
  return null;
}
