import { getFuelLogs, getFuelDeposits, createFuelRequest, getEquipment, getFuelRequests, getFuelLogEditRequests } from '@/lib/actions/fuel';
import { getTrucks } from '@/lib/actions/trucks';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';
import FuelClient from '@/components/fuel/FuelClient';

export default async function FuelPage() {
    const [logs, deposits, trucks, equipment, requests, editRequests, session] = await Promise.all([
        getFuelLogs(),
        getFuelDeposits(),
        getTrucks(),
        getEquipment(),
        getFuelRequests(),
        getFuelLogEditRequests(),
        auth()
    ]);

    const canLogFuel = session?.user?.role ? hasPermission(session.user.role, 'log_fuel') : false;
    const canManageFuel = session?.user?.role ? hasPermission(session.user.role, 'manage_fuel') : false;
    const canApproveFuelRequests = session?.user?.role
        ? hasPermission(session.user.role, 'approve_fuel_requests')
        : false;
    // Anyone who can open this page may propose an edit; approving is a separate gate.
    const canRequestFuelLogEdit = session?.user?.role
        ? hasPermission(session.user.role, 'view_fuel_logs')
        : false;

    return (
        <FuelClient
            logs={JSON.parse(JSON.stringify(logs))}
            deposits={JSON.parse(JSON.stringify(deposits))}
            trucks={JSON.parse(JSON.stringify(trucks))}
            equipment={JSON.parse(JSON.stringify(equipment))}
            requests={JSON.parse(JSON.stringify(requests))}
            canLogFuel={canLogFuel}
            canManageFuel={canManageFuel}
            canApproveFuelRequests={canApproveFuelRequests}
            canRequestFuelLogEdit={canRequestFuelLogEdit}
            pendingEditLogIds={editRequests.map((r) => r.entityId)}
            editRequests={JSON.parse(JSON.stringify(editRequests))}
            currentUserId={session?.user?.id ?? null}
            logFuelAction={createFuelRequest}
        />
    );
}
