import { uploadToGCS } from '../src/lib/gcsUpload';
import { deployToVercel } from '../src/lib/vercelDeploy';

interface DeploymentRequest {
  siteId: string;
  html: string;
  css?: string;
  images?: Array<{
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
    const body: DeploymentRequest = req.body;

    // Validate required inputs
    if (!body.siteId) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required field: siteId'
      });
    }

    if (!body.html) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required field: html'
      });
    }

    console.log(`[Deploy Site] Starting deployment for siteId: ${body.siteId}`);
    console.log(`[Deploy Site] Images to upload: ${body.images?.length || 0}`);

    // Step 1: Upload images to Google Cloud Storage
    const imageUrlMap: Record<string, string> = {};
    const uploadedImages: Record<string, string> = {};

    if (body.images && body.images.length > 0) {
      console.log('[Deploy Site] Uploading images to GCS...');

      for (const image of body.images) {
        if (!image.key || !image.filename || !image.base64) {
          console.warn(`[Deploy Site] Skipping invalid image: missing key, filename, or base64 data`);
          continue;
        }

        try {
          // Convert base64 to data URL format if not already
          let base64DataUrl = image.base64;
          if (!base64DataUrl.startsWith('data:')) {
            // Assume it's a JPEG if no MIME type provided
            base64DataUrl = `data:image/jpeg;base64,${image.base64}`;
          }

          const result = await uploadToGCS(
            body.siteId,
            image.filename,
            base64DataUrl
          );

          imageUrlMap[image.key] = result.publicUrl;
          uploadedImages[image.key] = result.publicUrl;

          console.log(`[Deploy Site] Uploaded ${image.key} -> ${result.publicUrl}`);

        } catch (uploadError: any) {
          console.error(`[Deploy Site] Failed to upload image ${image.key}:`, uploadError.message);
          // Continue with other images even if one fails
        }
      }

      console.log(`[Deploy Site] Successfully uploaded ${Object.keys(uploadedImages).length} images`);
    }

    // Step 2: Replace placeholders in HTML with actual URLs
    let processedHtml = body.html;

    for (const [key, url] of Object.entries(imageUrlMap)) {
      // Replace {{key}} with the actual URL
      const placeholder = `{{${key}}}`;
      processedHtml = processedHtml.split(placeholder).join(url);
    }

    console.log('[Deploy Site] HTML placeholders replaced');

    // Step 3: Prepare CSS file (blank if not provided)
    const cssContent = body.css || `/* No custom styles */`;

    // Step 4: Prepare files for Vercel deployment
    const files = [
      {
        file: 'index.html',
        data: Buffer.from(processedHtml).toString('base64'),
        encoding: 'base64' as const
      },
      {
        file: 'styles.css',
        data: Buffer.from(cssContent).toString('base64'),
        encoding: 'base64' as const
      }
    ];

    console.log('[Deploy Site] Deploying to Vercel...');

    // Step 5: Deploy to Vercel
    const vercelResult = await deployToVercel(body.siteId, files);

    console.log(`[Deploy Site] Deployment successful: ${vercelResult.deploymentUrl}`);

    // Step 6: Return success response
    return res.status(200).json({
      ok: true,
      deploymentUrl: vercelResult.deploymentUrl,
      uploadedImages: uploadedImages,
      stripeLink: process.env.STRIPE_PAYMENT_LINK || null
    });

  } catch (error: any) {
    console.error('[Deploy Site] Deployment failed:', error.message);

    // Return 500 for deployment failures
    return res.status(500).json({
      ok: false,
      error: 'Deployment failed',
      details: error.message
    });
  }
}
