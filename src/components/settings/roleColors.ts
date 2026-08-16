// Tailwind cannot see dynamically built class names, so every variant is written
// out in full here and shared by the role badge, the swatch picker and the user list.
export const ROLE_BADGE: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    rose: 'bg-rose-100 text-rose-700 border-rose-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const ROLE_SWATCH: Record<string, string> = {
    blue: 'bg-blue-600',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-600',
    purple: 'bg-purple-600',
    rose: 'bg-rose-600',
    slate: 'bg-slate-600',
};

export const DEFAULT_BADGE = 'bg-gray-100 text-gray-700 border-gray-200';

export function badgeFor(color: string | undefined): string {
    return (color && ROLE_BADGE[color]) || DEFAULT_BADGE;
}
