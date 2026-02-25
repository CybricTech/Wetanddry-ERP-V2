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

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const debug = request.nextUrl.searchParams.get('debug') === '1'

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

    const resourceType = doc.url.includes('/raw/upload/') ? 'raw' : 'image'
    const formatMatch = doc.url.match(/\.(\w+)(?:\?|$)/)
    const format = formatMatch ? formatMatch[1] : 'pdf'

    const attempts: { method: string; url: string; status: number }[] = []

    // Helper to try fetching a URL
    async function tryFetch(url: string, method: string): Promise<Response | null> {
        try {
            const resp = await fetch(url)
            attempts.push({ method, url, status: resp.status })
            if (resp.ok) return resp
        } catch {
            attempts.push({ method, url, status: 0 })
        }
        return null
    }

    // Helper to return successful response
    function serveResponse(resp: Response, buffer: ArrayBuffer) {
        const contentType = resp.headers.get('content-type') || 'application/octet-stream'
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `inline; filename="${doc!.name}"`,
                'Cache-Control': 'private, max-age=3600',
            },
        })
    }

    // Approach 1: private_download_url (API endpoint, not CDN)
    for (const rt of [resourceType, resourceType === 'image' ? 'raw' : 'image'] as const) {
        const downloadUrl = cloudinary.utils.private_download_url(
            doc.cloudinaryPublicId, format, { resource_type: rt }
        )
        const resp = await tryFetch(downloadUrl, `private_download-${rt}`)
        if (resp) return serveResponse(resp, await resp.arrayBuffer())
    }

    // Approach 2: Signed URL with long signature (SHA-256)
    for (const rt of [resourceType, resourceType === 'image' ? 'raw' : 'image'] as const) {
        const signedUrl = cloudinary.url(doc.cloudinaryPublicId, {
            secure: true,
            resource_type: rt,
            sign_url: true,
            type: 'upload',
            long_url_signature: true,
        })
        const resp = await tryFetch(signedUrl, `signed-long-${rt}`)
        if (resp) return serveResponse(resp, await resp.arrayBuffer())
    }

    // Approach 3: Use Admin API to get resource info, then try its secure_url
    for (const rt of [resourceType, resourceType === 'image' ? 'raw' : 'image'] as const) {
        try {
            const resource = await cloudinary.api.resource(doc.cloudinaryPublicId, {
                resource_type: rt,
            })
            if (resource?.secure_url) {
                const resp = await tryFetch(resource.secure_url, `admin-api-url-${rt}`)
                if (resp) return serveResponse(resp, await resp.arrayBuffer())
            }
        } catch {
            attempts.push({ method: `admin-api-${rt}`, url: 'API call failed', status: 0 })
        }
    }

    // Approach 4: Direct Cloudinary API download with Basic Auth header
    const basicAuth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
    for (const rt of [resourceType, resourceType === 'image' ? 'raw' : 'image'] as const) {
        const apiUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${rt}/download`
        const timestamp = Math.floor(Date.now() / 1000)
        const paramsToSign = `public_id=${doc.cloudinaryPublicId}&timestamp=${timestamp}`
        const signature = cloudinary.utils.api_sign_request(
            { public_id: doc.cloudinaryPublicId, timestamp },
            apiSecret!
        )

        const downloadApiUrl = `${apiUrl}?public_id=${encodeURIComponent(doc.cloudinaryPublicId)}&timestamp=${timestamp}&signature=${signature}&api_key=${apiKey}&format=${format}`
        const resp = await tryFetch(downloadApiUrl, `manual-api-download-${rt}`)
        if (resp) return serveResponse(resp, await resp.arrayBuffer())
    }

    if (debug) {
        return NextResponse.json({
            error: 'All fetch attempts failed',
            cloudName,
            publicId: doc.cloudinaryPublicId,
            storedUrl: doc.url,
            resourceType,
            format,
            attempts,
        }, { status: 502 })
    }

    return NextResponse.json(
        { error: 'Failed to fetch document from storage.' },
        { status: 502 }
    )
}
