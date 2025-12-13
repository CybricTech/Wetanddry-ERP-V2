import { notFound } from 'next/navigation'
import { getTruck } from '@/lib/actions/trucks'
import TruckDetailsClient from '@/components/trucks/TruckDetailsClient'
import { auth } from '@/auth'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function TruckDetailsPage({ params }: PageProps) {
    const { id } = await params
    const [truck, session] = await Promise.all([
        getTruck(id),
        auth()
    ])

    if (!truck) {
        notFound()
    }

    return <TruckDetailsClient truck={truck} userRole={session?.user?.role} />
}
