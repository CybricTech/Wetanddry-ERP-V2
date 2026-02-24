import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
    console.error('MISSING CLOUDINARY CONFIGURATION:', { cloudName, apiKey, apiSecret: apiSecret ? '***' : undefined });
}

cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
});

export async function uploadToCloudinary(file: File, folder: string, resourceType: 'auto' | 'raw' | 'image' | 'video' = 'auto') {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: resourceType,
                access_mode: 'public',
            },
            (error, result) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(result as any);
            }
        ).end(buffer);
    });
}

export function getSignedUrl(publicId: string, resourceType: 'image' | 'raw' | 'video' = 'raw') {
    return cloudinary.url(publicId, {
        secure: true,
        resource_type: resourceType,
        sign_url: true,
        type: 'upload',
    });
}

export async function deleteFromCloudinary(publicId: string) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.destroy(publicId, (error, result) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(result);
        });
    });
}
