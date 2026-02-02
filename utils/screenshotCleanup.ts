import fs from 'fs';
import path from 'path';

/**
 * Automatically removes old diagnostic files
 * @param folder Path to the folder to clean
 * @param maxAgeDays Files older than this will be deleted
 */
export function cleanOldFiles(folder: string, maxAgeDays: number = 3) {
  const directory = path.join(process.cwd(), folder);

  if (!fs.existsSync(directory)) return;

  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  const threshold = maxAgeDays * msPerDay;

  fs.readdirSync(directory).forEach((file) => {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);

    if (now - stats.mtimeMs > threshold) {
      try {
        fs.unlinkSync(filePath);
        console.log(`[Cleanup] Deleted old file: ${file}`);
      } catch (err) {
        console.error(`[Cleanup] Failed to delete ${file}:`, err);
      }
    }
  });
}