import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const toBase64 = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

const safeFilename = (filename: string) => filename.replace(/[\\/:*?"<>|\r\n]+/g, '-').trim() || 'download.pdf';

export async function downloadFile(blob: Blob, requestedFilename: string): Promise<'downloaded' | 'saved'> {
  const filename = safeFilename(requestedFilename);
  if (Capacitor.isNativePlatform()) {
    const file = await Filesystem.writeFile({
      path: filename,
      data: await toBase64(blob),
      directory: Directory.Documents,
      recursive: true,
    });
    const canShare = await Share.canShare();
    if (canShare.value) {
      await Share.share({
        title: filename,
        text: 'CV saved to Documents. You can also share it with another app.',
        files: [file.uri],
        dialogTitle: 'Save or share CV',
      });
    }
    return 'saved';
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
