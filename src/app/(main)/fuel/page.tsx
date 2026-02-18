import { getFuelLogs, getFuelDeposits, logFuel } from '@/lib/actions/fuel';
import { getTrucks } from '@/lib/actions/trucks';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';
import FuelClient from '@/components/fuel/FuelClient';

export default async function FuelPage() {
    const [logs, deposits, trucks, session] = await Promise.all([
        getFuelLogs(),
        getFuelDeposits(),
        getTrucks(),
        auth()
    ]);

    const canLogFuel = session?.user?.role ? hasPermission(session.user.role, 'log_fuel') : false;
    const canManageFuel = session?.user?.role ? hasPermission(session.user.role, 'manage_fuel') : false;

    return (
        <FuelClient
            logs={JSON.parse(JSON.stringify(logs))}
            deposits={JSON.parse(JSON.stringify(deposits))}
            trucks={JSON.parse(JSON.stringify(trucks))}
            canLogFuel={canLogFuel}
            canManageFuel={canManageFuel}
            logFuelAction={logFuel}
        />
    );
}
