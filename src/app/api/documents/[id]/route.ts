import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { v2 as cloudinary } from 'cloudinary'

// Ensure Cloudinary is configured
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // Verify user is authenticated
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Look up document in both tables, including cloudinaryPublicId
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

    // Build fresh URLs from the cloudinaryPublicId using the current cloud name.
    // The stored url may reference an old/wrong cloud name.
    // Try multiple resource types since 'auto' uploads can store as 'image' or 'raw'.
    const resourceTypes: Array<'image' | 'raw'> = []

    // Detect from stored URL if possible
    if (doc.url.includes('/image/upload/')) {
        resourceTypes.push('image', 'raw')
    } else if (doc.url.includes('/raw/upload/')) {
        resourceTypes.push('raw', 'image')
    } else {
        resourceTypes.push('image', 'raw')
    }

    for (const resourceType of resourceTypes) {
        const freshUrl = cloudinary.url(doc.cloudinaryPublicId, {
            secure: true,
            resource_type: resourceType,
            sign_url: true,
            type: 'upload',
        })

        try {
            const response = await fetch(freshUrl)

            if (response.ok) {
                const contentType = response.headers.get('content-type') || 'application/octet-stream'
                const buffer = await response.arrayBuffer()

                return new NextResponse(buffer, {
                    headers: {
                        'Content-Type': contentType,
                        'Content-Disposition': `inline; filename="${doc.name}"`,
                        'Cache-Control': 'private, max-age=3600',
                    },
                })
            }
        } catch {
            // Try next resource type
            continue
        }
    }

    // If signed URLs didn't work, try the stored URL directly as a last resort
    try {
        const response = await fetch(doc.url)
        if (response.ok) {
            const contentType = response.headers.get('content-type') || 'application/octet-stream'
            const buffer = await response.arrayBuffer()

            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': contentType,
                    'Content-Disposition': `inline; filename="${doc.name}"`,
                    'Cache-Control': 'private, max-age=3600',
                },
            })
        }
    } catch {
        // Fall through to error
    }

    return NextResponse.json(
        { error: 'Failed to fetch document from storage. The file may need to be re-uploaded.' },
        { status: 502 }
    )
}
