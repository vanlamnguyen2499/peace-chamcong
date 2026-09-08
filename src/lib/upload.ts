import fs from 'fs';
import path from 'path';

/**
 * Save base64 data URL or buffer to public/uploads directory
 */
export async function saveBase64Image(base64Data: string, prefix: string = 'selfie'): Promise<string> {
  if (!base64Data) return '';

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Check if it's already a URL
  if (base64Data.startsWith('http') || base64Data.startsWith('/uploads/')) {
    return base64Data;
  }

  // Extract base64 content
  const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  let buffer: Buffer;
  let extension = 'jpg';

  if (matches && matches.length === 3) {
    const mime = matches[1];
    if (mime.includes('png')) extension = 'png';
    else if (mime.includes('webp')) extension = 'webp';
    buffer = Buffer.from(matches[2], 'base64');
  } else {
    buffer = Buffer.from(base64Data, 'base64');
  }

  const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
  const filePath = path.join(uploadsDir, fileName);
  await fs.promises.writeFile(filePath, buffer);

  return `/uploads/${fileName}`;
}
