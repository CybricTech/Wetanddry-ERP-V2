import { getFuelLogs, getFuelDeposits, logFuel, getEquipment } from '@/lib/actions/fuel';
import { getTrucks } from '@/lib/actions/trucks';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';
import FuelClient from '@/components/fuel/FuelClient';

export default async function FuelPage() {
    const [logs, deposits, trucks, equipment, session] = await Promise.all([
        getFuelLogs(),
        getFuelDeposits(),
        getTrucks(),
        getEquipment(),
        auth()
    ]);

    const canLogFuel = session?.user?.role ? hasPermission(session.user.role, 'log_fuel') : false;
    const canManageFuel = session?.user?.role ? hasPermission(session.user.role, 'manage_fuel') : false;

    return (
        <FuelClient
            logs={JSON.parse(JSON.stringify(logs))}
            deposits={JSON.parse(JSON.stringify(deposits))}
            trucks={JSON.parse(JSON.stringify(trucks))}
            equipment={JSON.parse(JSON.stringify(equipment))}
            canLogFuel={canLogFuel}
            canManageFuel={canManageFuel}
            logFuelAction={logFuel}
        />
    );
}
