import { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import FinanceClient from './FinanceClient';

export const metadata: Metadata = {
    title: 'Finance & Reports | Wetanddry ERP',
    description: 'Company-wide financial overview and reports',
};

export default async function FinancePage() {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    // Check permission - only Manager, Accountant, Super Admin
    if (!hasPermission(session.user.role || '', 'view_financials')) {
        redirect('/dashboard');
    }

    return <FinanceClient currentUser={session.user.name || 'Unknown'} userRole={session.user.role || ''} />;
}
