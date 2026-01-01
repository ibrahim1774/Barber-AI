import { uploadToGCS } from '../src/lib/gcsUpload';

interface UploadImagesRequest {
  siteId: string;
  images: Array<{
    key: string;
    filename: string;
    base64: string;
  }>;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
  }

  try {
    const body: UploadImagesRequest = req.body;

    if (!body.siteId) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required field: siteId'
      });
    }

    if (!body.images || body.images.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required field: images array'
      });
    }

    console.log(`[Upload Images] Uploading ${body.images.length} images for siteId: ${body.siteId}`);

    const imageUrlMap: Record<string, string> = {};
    const errors: Array<{ key: string; error: string }> = [];

    // Upload images sequentially to avoid overwhelming GCS
    for (const image of body.images) {
      if (!image.key || !image.filename || !image.base64) {
        console.warn(`[Upload Images] Skipping invalid image: missing key, filename, or base64 data`);
        errors.push({ key: image.key || 'unknown', error: 'Missing required fields' });
        continue;
      }

      try {
        // Convert base64 to data URL format if not already
        let base64DataUrl = image.base64;
        if (!base64DataUrl.startsWith('data:')) {
          // Assume it's a JPEG if no MIME type provided
          const extension = image.filename.split('.').pop()?.toLowerCase();
          const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
          base64DataUrl = `data:${mimeType};base64,${image.base64}`;
        }

        const result = await uploadToGCS(
          body.siteId,
          image.filename,
          base64DataUrl
        );

        imageUrlMap[image.key] = result.publicUrl;
        console.log(`[Upload Images] ✓ Uploaded ${image.key} -> ${result.publicUrl}`);

      } catch (uploadError: any) {
        console.error(`[Upload Images] ✗ Failed to upload image ${image.key}:`, uploadError.message);
        errors.push({ key: image.key, error: uploadError.message });
      }
    }

    const successCount = Object.keys(imageUrlMap).length;
    const failCount = errors.length;

    console.log(`[Upload Images] Upload complete: ${successCount} succeeded, ${failCount} failed`);

    return res.status(200).json({
      ok: true,
      imageUrls: imageUrlMap,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('[Upload Images] Upload failed:', error.message);
    return res.status(500).json({
      ok: false,
      error: 'Image upload failed',
      details: error.message
    });
  }
}

