import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

function detectResourceType(url: string): 'image' | 'raw' | 'video' {
    if (url.includes('/image/upload/')) return 'image'
    if (url.includes('/video/upload/')) return 'video'
    return 'raw'
}

const MIME_TYPES: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
}

function getContentTypeFromNameOrUrl(name: string, url: string): string | null {
    // Try from file name first
    const nameExt = name.toLowerCase().split('.').pop()
    if (nameExt && MIME_TYPES[nameExt]) return MIME_TYPES[nameExt]

    // Try from URL (strip query params first)
    const urlPath = url.split('?')[0]
    const urlExt = urlPath.split('.').pop()?.toLowerCase()
    if (urlExt && MIME_TYPES[urlExt]) return MIME_TYPES[urlExt]

    return null
}

export async function GET(
    _request: NextRequest,
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

    // Determine content type from file name or URL, fall back to response header
    const knownContentType = getContentTypeFromNameOrUrl(doc.name, doc.url)

    const makeResponse = (buffer: ArrayBuffer, fallbackContentType: string) => {
        // Prefer known type; if Cloudinary returns octet-stream (raw uploads), default to PDF
        const contentType = knownContentType
            || (fallbackContentType === 'application/octet-stream' ? 'application/pdf' : fallbackContentType)
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `inline; filename="${doc!.name}"`,
                'Cache-Control': 'private, max-age=3600',
            },
        })
    }

    // Try the stored URL directly
    try {
        const resp = await fetch(doc.url)
        if (resp.ok) {
            const contentType = resp.headers.get('content-type') || 'application/octet-stream'
            return makeResponse(await resp.arrayBuffer(), contentType)
        }
    } catch {}

    // Try signed URL
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

    // Try private download URL with correct resource_type and format
    try {
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

    return NextResponse.json(
        { error: 'Failed to fetch document from storage.' },
        { status: 502 }
    )
}
