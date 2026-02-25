import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { v2 as cloudinary } from 'cloudinary'

const cloudName = process.env.CLOUDINARY_CLOUD_NAME
const apiKey = process.env.CLOUDINARY_API_KEY
const apiSecret = process.env.CLOUDINARY_API_SECRET

cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
})

/**
 * Detect resource type from the Cloudinary URL pattern.
 */
function detectResourceType(url: string): 'image' | 'raw' | 'video' {
    if (url.includes('/image/upload/')) return 'image'
    if (url.includes('/video/upload/')) return 'video'
    return 'raw'
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    let doc: { url: string; name: string; cloudinaryPublicId: string } | null =
        await prisma.truckDocument.findUnique({
            where: { id },
            select: { url: true, name: true, cloudinaryPublicId: true },
        })

    if (!doc) {
        doc = await prisma.staffDocument.findUnique({
            where: { id },
            select: { url: true, name: true, cloudinaryPublicId: true },
        })
    }

    if (!doc) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const resourceType = detectResourceType(doc.url)

    // Helper to return a successful document response
    const makeResponse = (buffer: ArrayBuffer, contentType: string) => {
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `inline; filename="${doc!.name}"`,
                'Cache-Control': 'private, max-age=3600',
            },
        })
    }

    // Approach 1: Try the stored URL directly
    try {
        const resp = await fetch(doc.url)
        if (resp.ok) {
            const contentType = resp.headers.get('content-type') || 'application/octet-stream'
            return makeResponse(await resp.arrayBuffer(), contentType)
        }
    } catch {}

    // Approach 2: Try signed URL with correct resource type
    try {
        const signedUrl = cloudinary.url(doc.cloudinaryPublicId, {
            secure: true,
            resource_type: resourceType,
            sign_url: true,
            type: 'upload',
        })
        const resp = await fetch(signedUrl)
        if (resp.ok) {
            const contentType = resp.headers.get('content-type') || 'application/octet-stream'
            return makeResponse(await resp.arrayBuffer(), contentType)
        }
    } catch {}

    // Approach 3: Try private_download_url with correct resource_type and format
    try {
        // Extract format from URL (e.g., "pdf" from ".pdf")
        const urlParts = doc.url.split('.')
        const format = urlParts[urlParts.length - 1] || 'pdf'

        const privateUrl = cloudinary.utils.private_download_url(
            doc.cloudinaryPublicId,
            format,
            {
                resource_type: resourceType,
                type: 'upload',
                expires_at: Math.floor(Date.now() / 1000) + 3600,
            }
        )
        const resp = await fetch(privateUrl)
        if (resp.ok) {
            const contentType = resp.headers.get('content-type') || 'application/octet-stream'
            return makeResponse(await resp.arrayBuffer(), contentType)
        }
    } catch {}

    // Approach 4: Use authenticated Cloudinary Admin API to download the content
    // The Admin API works (confirmed), so we use Basic Auth to fetch the resource
    // and then try to fetch the secure_url from the response with auth headers
    try {
        const resource = await cloudinary.api.resource(doc.cloudinaryPublicId, {
            resource_type: resourceType,
        })

        if (resource.secure_url) {
            // Try fetching the secure_url from the Admin API response
            const resp = await fetch(resource.secure_url)
            if (resp.ok) {
                const contentType = resp.headers.get('content-type') || 'application/octet-stream'
                return makeResponse(await resp.arrayBuffer(), contentType)
            }
        }
    } catch {}

    // Approach 5: Download via Cloudinary's authenticated content API
    // Use Basic Auth against the Cloudinary API to download the actual file bytes
    try {
        const basicAuth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')

        // Try the content delivery with auth
        const urls = [
            // Authenticated API download endpoint
            `https://${apiKey}:${apiSecret}@api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload/${doc.cloudinaryPublicId}`,
            // CDN URL with fl_attachment transformation
            `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/fl_attachment/${doc.cloudinaryPublicId}`,
        ]

        for (const url of urls) {
            try {
                const resp = await fetch(url, {
                    headers: url.includes('api.cloudinary.com')
                        ? { 'Authorization': `Basic ${basicAuth}` }
                        : {},
                })
                if (resp.ok) {
                    const ct = resp.headers.get('content-type') || 'application/octet-stream'
                    // Skip if it returns JSON (metadata) instead of file content
                    if (!ct.includes('application/json')) {
                        return makeResponse(await resp.arrayBuffer(), ct)
                    }
                }
            } catch {}
        }
    } catch {}

    // Approach 6: Generate a zip archive containing the single file and extract it
    try {
        const archiveUrl = cloudinary.utils.download_zip_url({
            public_ids: [doc.cloudinaryPublicId],
            resource_type: resourceType,
        })
        const resp = await fetch(archiveUrl)
        if (resp.ok) {
            // This will be a zip file - still better than nothing
            // Return it as a downloadable file
            return new NextResponse(await resp.arrayBuffer(), {
                headers: {
                    'Content-Type': 'application/zip',
                    'Content-Disposition': `attachment; filename="${doc.name}.zip"`,
                },
            })
        }
    } catch {}

    return NextResponse.json(
        { error: 'Failed to fetch document from storage. All delivery methods failed.' },
        { status: 502 }
    )
}
