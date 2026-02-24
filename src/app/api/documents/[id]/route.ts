import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

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

    // Look up document in both tables
    let doc = await prisma.truckDocument.findUnique({
        where: { id },
        select: { url: true, name: true },
    })

    if (!doc) {
        doc = await prisma.staffDocument.findUnique({
            where: { id },
            select: { url: true, name: true },
        })
    }

    if (!doc || !doc.url) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    try {
        // Fetch the file from Cloudinary server-side
        const response = await fetch(doc.url)

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch document: ${response.status}` },
                { status: response.status }
            )
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
        console.error('Error proxying document:', error)
        return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 })
    }
}
