import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
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

    // Determine resource type from the stored URL
    const resourceType = doc.url.includes('/raw/upload/') ? 'raw' : 'image'

    // Detect format from the stored URL (e.g. .pdf, .jpg)
    const formatMatch = doc.url.match(/\.(\w+)(?:\?|$)/)
    const format = formatMatch ? formatMatch[1] : 'pdf'

    try {
        // Use Cloudinary's private_download_url which generates an authenticated
        // API download URL that bypasses CDN restrictions and Strict Transformations
        const downloadUrl = cloudinary.utils.private_download_url(
            doc.cloudinaryPublicId,
            format,
            { resource_type: resourceType }
        )

        const response = await fetch(downloadUrl)

        if (!response.ok) {
            // Fallback: try the other resource type
            const altResourceType = resourceType === 'image' ? 'raw' : 'image'
            const altUrl = cloudinary.utils.private_download_url(
                doc.cloudinaryPublicId,
                format,
                { resource_type: altResourceType }
            )

            const altResponse = await fetch(altUrl)
            if (!altResponse.ok) {
                return NextResponse.json(
                    { error: `Failed to fetch document (${response.status} / ${altResponse.status})` },
                    { status: 502 }
                )
            }

            const contentType = altResponse.headers.get('content-type') || 'application/octet-stream'
            const buffer = await altResponse.arrayBuffer()
            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': contentType,
                    'Content-Disposition': `inline; filename="${doc.name}"`,
                    'Cache-Control': 'private, max-age=3600',
                },
            })
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream'
        const buffer = await response.arrayBuffer()

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `inline; filename="${doc.name}"`,
                'Cache-Control': 'private, max-age=3600',
            },
        })
    } catch (error) {
        console.error('Error fetching document:', error)
        return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 })
    }
}
