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

    // If debug mode, return the full resource metadata from Admin API
    if (debug) {
        try {
            const resource = await cloudinary.api.resource(doc.cloudinaryPublicId, {
                resource_type: resourceType,
            })
            return NextResponse.json({
                storedUrl: doc.url,
                publicId: doc.cloudinaryPublicId,
                cloudName,
                resourceMetadata: {
                    secure_url: resource.secure_url,
                    url: resource.url,
                    format: resource.format,
                    resource_type: resource.resource_type,
                    type: resource.type,
                    access_mode: resource.access_mode,
                    access_control: resource.access_control,
                    bytes: resource.bytes,
                    created_at: resource.created_at,
                },
            })
        } catch (error: any) {
            return NextResponse.json({
                error: 'Admin API failed',
                message: error?.message || String(error),
                storedUrl: doc.url,
                publicId: doc.cloudinaryPublicId,
                cloudName,
            }, { status: 502 })
        }
    }

    // Non-debug: try to fetch the document
    // First try the stored URL directly
    try {
        const resp = await fetch(doc.url)
        if (resp.ok) {
            const contentType = resp.headers.get('content-type') || 'application/octet-stream'
            const buffer = await resp.arrayBuffer()
            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': contentType,
                    'Content-Disposition': `inline; filename="${doc.name}"`,
                    'Cache-Control': 'private, max-age=3600',
                },
            })
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
            const buffer = await resp.arrayBuffer()
            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': contentType,
                    'Content-Disposition': `inline; filename="${doc.name}"`,
                    'Cache-Control': 'private, max-age=3600',
                },
            })
        }
    } catch {}

    return NextResponse.json(
        { error: 'Failed to fetch document from storage.' },
        { status: 502 }
    )
}
