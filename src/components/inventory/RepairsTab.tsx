'use client';

import { useState, useTransition, useMemo } from 'react';
import {
    Wrench, AlertTriangle, CheckCircle2, DollarSign, Plus, X, Loader2,
    Clock, Search, ArrowLeftRight, Ban, Pencil
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { sendItemForRepair, returnRepairedItem, cancelRepair, updateRepair } from '@/lib/actions/inventory';

export interface RepairItem {
    id: string;
    name: string;
    unit: string;
    quantity: number;
    location: { name: string };
}

export interface Repair {
    id: string;
    itemId: string;
    item: RepairItem;
    quantity: number;
    sentDate: Date | string;
    expectedReturnDate: Date | string;
    actualReturnDate: Date | string | null;
    quantityReturned: number | null;
    vendor: string | null;
    contactPhone: string | null;
    issueDescription: string;
    estimatedCost: number | null;
    actualCost: number | null;
    status: string;
    sentBy: string | null;
    receivedBy: string | null;
    notes: string | null;
    isOverdue: boolean;
    daysOut: number;
    daysOverdue: number;
    daysRemaining: number;
}

export interface RepairStats {
    currentlyOut: number;
    overdue: number;
    returnedThisMonth: number;
    costThisMonth: number;
}

type Filter = 'All' | 'Out for Repair' | 'Overdue' | 'Returned';

const formatDate = (value: Date | string) =>
    new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Colour follows urgency, not status: green while there is comfortable time left,
 * amber inside the last three days, red once the date has passed.
 */
function TimingBadge({ repair }: { repair: Repair }) {
    if (repair.status === 'Cancelled') {
        return <span className="text-xs text-gray-400">—</span>;
    }

    if (repair.status !== 'Out for Repair') {
        return (
            <span className="text-xs text-gray-500">
                {repair.daysOut} day{repair.daysOut === 1 ? '' : 's'} out
            </span>
        );
    }

    if (repair.isOverdue) {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700">
                <AlertTriangle size={12} />
                {repair.daysOverdue === 0
                    ? 'Due today'
                    : `${repair.daysOverdue} day${repair.daysOverdue === 1 ? '' : 's'} overdue`}
            </span>
        );
    }

    const urgent = repair.daysRemaining <= 3;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
                urgent ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
            )}
        >
            <Clock size={12} />
            {repair.daysRemaining === 0
                ? 'Due today'
                : `${repair.daysRemaining} day${repair.daysRemaining === 1 ? '' : 's'} left`}
        </span>
    );
}

function StatusPill({ status }: { status: string }) {
    const styles: Record<string, string> = {
        'Out for Repair': 'bg-blue-50 text-blue-700',
        Returned: 'bg-emerald-50 text-emerald-700',
        'Returned - Unrepairable': 'bg-red-50 text-red-700',
        Cancelled: 'bg-gray-100 text-gray-500',
    };
    const label = status === 'Returned - Unrepairable' ? 'Unrepairable' : status;

    return (
        <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap', styles[status] ?? 'bg-gray-100 text-gray-600')}>
            {label}
        </span>
    );
}

export default function RepairsTab({
    repairs,
    stats,
    items,
    canManage,
}: {
    repairs: Repair[];
    stats: RepairStats;
    items: RepairItem[];
    canManage: boolean;
}) {
    const [filter, setFilter] = useState<Filter>('All');
    const [search, setSearch] = useState('');
    const [showSendModal, setShowSendModal] = useState(false);
    const [returningRepair, setReturningRepair] = useState<Repair | null>(null);
    const [cancellingRepair, setCancellingRepair] = useState<Repair | null>(null);
    const [editingRepair, setEditingRepair] = useState<Repair | null>(null);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        return repairs.filter((repair) => {
            const matchesFilter =
                filter === 'All' ||
                (filter === 'Overdue' ? repair.isOverdue : repair.status === filter);
            if (!matchesFilter) return false;
            if (!query) return true;
            return (
                repair.item.name.toLowerCase().includes(query) ||
                (repair.vendor ?? '').toLowerCase().includes(query) ||
                repair.issueDescription.toLowerCase().includes(query)
            );
        });
    }, [repairs, filter, search]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Currently Out"
                    value={stats.currentlyOut.toString()}
                    icon={<Wrench size={20} />}
                    tone="blue"
                />
                <StatCard
                    title="Overdue"
                    value={stats.overdue.toString()}
                    icon={<AlertTriangle size={20} />}
                    tone="red"
                    emphasise={stats.overdue > 0}
                />
                <StatCard
                    title="Returned This Month"
                    value={stats.returnedThisMonth.toString()}
                    icon={<CheckCircle2 size={20} />}
                    tone="emerald"
                />
                <StatCard
                    title="Repair Cost This Month"
                    value={formatCurrency(stats.costThisMonth)}
                    icon={<DollarSign size={20} />}
                    tone="amber"
                />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                    <div className="flex gap-2 overflow-x-auto">
                        {(['All', 'Out for Repair', 'Overdue', 'Returned'] as Filter[]).map((option) => {
                            const count =
                                option === 'All'
                                    ? repairs.length
                                    : option === 'Overdue'
                                        ? repairs.filter((r) => r.isOverdue).length
                                        : repairs.filter((r) => r.status === option).length;
                            return (
                                <button
                                    key={option}
                                    onClick={() => setFilter(option)}
                                    className={cn(
                                        'px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
                                        filter === option
                                            ? option === 'Overdue'
                                                ? 'bg-red-50 text-red-700'
                                                : 'bg-blue-50 text-blue-700'
                                            : 'text-gray-600 hover:bg-gray-50'
                                    )}
                                >
                                    {option} {count > 0 && <span className="tabular-nums opacity-60">({count})</span>}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search item, vendor, fault..."
                                className="pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all w-full lg:w-64"
                            />
                        </div>
                        {canManage && (
                            <button
                                onClick={() => setShowSendModal(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors whitespace-nowrap active:scale-[0.98]"
                            >
                                <Plus size={16} />
                                Send for Repair
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500">
                            <tr>
                                <th className="text-left font-semibold px-6 py-3 whitespace-nowrap">Item</th>
                                <th className="text-left font-semibold px-6 py-3 whitespace-nowrap">Qty</th>
                                <th className="text-left font-semibold px-6 py-3 whitespace-nowrap">Vendor</th>
                                <th className="text-left font-semibold px-6 py-3 whitespace-nowrap">Sent</th>
                                <th className="text-left font-semibold px-6 py-3 whitespace-nowrap">Expected</th>
                                <th className="text-left font-semibold px-6 py-3 whitespace-nowrap">Timing</th>
                                <th className="text-left font-semibold px-6 py-3 whitespace-nowrap">Cost</th>
                                <th className="text-left font-semibold px-6 py-3 whitespace-nowrap">Status</th>
                                {canManage && <th className="px-6 py-3" />}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map((repair) => (
                                <tr
                                    key={repair.id}
                                    className={cn('hover:bg-gray-50/70 transition-colors', repair.isOverdue && 'bg-red-50/40')}
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{repair.item.name}</div>
                                        <div className="text-xs text-gray-500 max-w-xs truncate" title={repair.issueDescription}>
                                            {repair.issueDescription}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                                        {repair.quantity} {repair.item.unit}
                                        {repair.quantityReturned !== null && repair.quantityReturned < repair.quantity && (
                                            <div className="text-xs text-amber-600">{repair.quantityReturned} back</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-gray-700">
                                        {repair.vendor || <span className="text-gray-400">—</span>}
                                        {repair.contactPhone && (
                                            <div className="text-xs text-gray-400">{repair.contactPhone}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{formatDate(repair.sentDate)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                        {formatDate(repair.expectedReturnDate)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <TimingBadge repair={repair} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                                        {repair.actualCost !== null
                                            ? formatCurrency(repair.actualCost)
                                            : repair.estimatedCost !== null
                                                ? <span className="text-gray-400">~{formatCurrency(repair.estimatedCost)}</span>
                                                : <span className="text-gray-400">—</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusPill status={repair.status} />
                                    </td>
                                    {canManage && (
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            {repair.status === 'Out for Repair' && (
                                                <div className="flex items-center gap-1 justify-end">
                                                    <button
                                                        onClick={() => setReturningRepair(repair)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                                                    >
                                                        <ArrowLeftRight size={12} />
                                                        Mark Returned
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingRepair(repair)}
                                                        title="Edit vendor, expected return date or cost"
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => setCancellingRepair(repair)}
                                                        title="Cancel repair and restore stock"
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Ban size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}

                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={canManage ? 9 : 8} className="px-6 py-12 text-center">
                                        <Wrench size={28} className="mx-auto text-gray-300" />
                                        <p className="text-sm text-gray-500 mt-3">
                                            {repairs.length === 0
                                                ? 'Nothing has been sent for repair yet.'
                                                : 'No repairs match this filter.'}
                                        </p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showSendModal && (
                <SendForRepairModal items={items} onClose={() => setShowSendModal(false)} />
            )}
            {returningRepair && (
                <MarkReturnedModal repair={returningRepair} onClose={() => setReturningRepair(null)} />
            )}
            {cancellingRepair && (
                <CancelRepairModal repair={cancellingRepair} onClose={() => setCancellingRepair(null)} />
            )}
            {editingRepair && (
                <EditRepairModal repair={editingRepair} onClose={() => setEditingRepair(null)} />
            )}
        </div>
    );
}

function StatCard({
    title,
    value,
    icon,
    tone,
    emphasise = false,
}: {
    title: string;
    value: string;
    icon: React.ReactNode;
    tone: 'blue' | 'red' | 'emerald' | 'amber';
    emphasise?: boolean;
}) {
    const tones = {
        blue: 'bg-blue-50 text-blue-600',
        red: 'bg-red-50 text-red-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber: 'bg-amber-50 text-amber-600',
    };

    return (
        <div
            className={cn(
                'bg-white rounded-2xl border p-5 shadow-sm transition-colors',
                emphasise ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-100'
            )}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
                    <p className={cn('text-2xl font-bold mt-2 tabular-nums', emphasise ? 'text-red-600' : 'text-gray-900')}>
                        {value}
                    </p>
                </div>
                <div className={cn('p-2.5 rounded-xl', tones[tone])}>{icon}</div>
            </div>
        </div>
    );
}

function SendForRepairModal({ items, onClose }: { items: RepairItem[]; onClose: () => void }) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [selectedItemId, setSelectedItemId] = useState('');
    const [itemSearch, setItemSearch] = useState('');

    const selectedItem = items.find((i) => i.id === selectedItemId);
    const availableItems = useMemo(() => {
        const query = itemSearch.trim().toLowerCase();
        return items
            .filter((i) => i.quantity > 0)
            .filter((i) => !query || i.name.toLowerCase().includes(query));
    }, [items, itemSearch]);

    const today = new Date().toISOString().split('T')[0];

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(null);

        startTransition(async () => {
            const result = await sendItemForRepair(formData);
            if ('error' in result && result.error) {
                setError(result.error);
                return;
            }
            onClose();
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 rounded-xl border border-white/20">
                                <Wrench size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold tracking-tight">Send Item for Repair</h3>
                                <p className="text-blue-100 text-sm mt-1">
                                    The quantity you send leaves available stock until it returns
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 overflow-y-auto flex-1 space-y-6">
                    {error && (
                        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                            Search Items
                        </label>
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                value={itemSearch}
                                onChange={(e) => setItemSearch(e.target.value)}
                                placeholder="Filter the list below..."
                                className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                            />
                        </div>

                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                            Item *
                        </label>
                        <select
                            name="itemId"
                            value={selectedItemId}
                            onChange={(e) => setSelectedItemId(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                        >
                            <option value="">Choose an item...</option>
                            {availableItems.map((i) => (
                                <option key={i.id} value={i.id}>
                                    {i.name} • {i.quantity} {i.unit} available • {i.location.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                Quantity *
                            </label>
                            <input
                                type="number"
                                name="quantity"
                                step="any"
                                min="0"
                                max={selectedItem?.quantity}
                                required
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                placeholder={selectedItem ? `Up to ${selectedItem.quantity}` : '0'}
                            />
                            {selectedItem && (
                                <p className="text-xs text-gray-400 mt-1.5">
                                    {selectedItem.quantity} {selectedItem.unit} currently available
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                Vendor / Workshop
                            </label>
                            <input
                                type="text"
                                name="vendor"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-gray-400"
                                placeholder="e.g., Kano Engineering Works"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                Contact Phone
                            </label>
                            <input
                                type="tel"
                                name="contactPhone"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-gray-400"
                                placeholder="e.g., 0803 000 0000"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                Estimated Cost
                            </label>
                            <input
                                type="number"
                                name="estimatedCost"
                                step="any"
                                min="0"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-gray-400"
                                placeholder="0.00"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                Date Sent *
                            </label>
                            <DatePicker
                                name="sentDate"
                                value={today}
                                className="py-3 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-blue-500/10 text-gray-700"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                Expected Return *
                            </label>
                            <DatePicker
                                name="expectedReturnDate"
                                className="py-3 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-blue-500/10 text-gray-700"
                            />
                            <p className="text-xs text-gray-400 mt-1.5">
                                The repair is flagged overdue once this date passes.
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                            What is wrong with it? *
                        </label>
                        <textarea
                            name="issueDescription"
                            required
                            rows={2}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-gray-400 resize-none"
                            placeholder="e.g., Motor burnt out, will not start"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                            Notes
                        </label>
                        <textarea
                            name="notes"
                            rows={2}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-gray-400 resize-none"
                            placeholder="Anything else worth recording"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3.5 px-6 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors active:scale-[0.98]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-[2] py-3.5 px-6 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {isPending && <Loader2 size={18} className="animate-spin" />}
                            {isPending ? 'Sending...' : 'Send for Repair'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function MarkReturnedModal({ repair, onClose }: { repair: Repair; onClose: () => void }) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [unrepairable, setUnrepairable] = useState(false);

    const today = new Date().toISOString().split('T')[0];

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set('unrepairable', unrepairable.toString());
        setError(null);

        startTransition(async () => {
            const result = await returnRepairedItem(repair.id, formData);
            if ('error' in result && result.error) {
                setError(result.error);
                return;
            }
            onClose();
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-6 bg-gradient-to-br from-emerald-600 to-teal-700 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold tracking-tight">Mark Returned</h3>
                            <p className="text-emerald-100 text-sm mt-1">
                                {repair.item.name} · {repair.quantity} {repair.item.unit} sent
                                {repair.vendor ? ` to ${repair.vendor}` : ''}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                            <X size={22} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
                    {error && (
                        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => setUnrepairable(!unrepairable)}
                        className={cn(
                            'w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-colors',
                            unrepairable ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200 hover:border-gray-300'
                        )}
                    >
                        <span
                            className={cn(
                                'mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                                unrepairable ? 'bg-red-600 border-red-600' : 'bg-white border-gray-300'
                            )}
                        >
                            {unrepairable && <CheckCircle2 size={14} className="text-white" />}
                        </span>
                        <span>
                            <span className="block text-sm font-medium text-gray-900">Came back unrepairable</span>
                            <span className="block text-xs text-gray-500 mt-0.5">
                                Nothing is returned to stock — the whole quantity is written off.
                            </span>
                        </span>
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                Return Date *
                            </label>
                            <DatePicker
                                name="actualReturnDate"
                                value={today}
                                className="py-3 bg-gray-50 border-gray-200 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/10 text-gray-700"
                            />
                        </div>

                        {!unrepairable && (
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                    Quantity Returned *
                                </label>
                                <input
                                    type="number"
                                    name="quantityReturned"
                                    step="any"
                                    min="0"
                                    max={repair.quantity}
                                    defaultValue={repair.quantity}
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                                />
                                <p className="text-xs text-gray-400 mt-1.5">
                                    Anything short of {repair.quantity} is written off.
                                </p>
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                Actual Cost
                            </label>
                            <input
                                type="number"
                                name="actualCost"
                                step="any"
                                min="0"
                                defaultValue={repair.estimatedCost ?? undefined}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                                placeholder="0.00"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                Received By
                            </label>
                            <input
                                type="text"
                                name="receivedBy"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-gray-400"
                                placeholder="Defaults to you"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                            Notes
                        </label>
                        <textarea
                            name="notes"
                            rows={2}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-gray-400 resize-none"
                            placeholder="What was done, parts replaced, warranty..."
                        />
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3.5 px-6 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors active:scale-[0.98]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className={cn(
                                'flex-[2] py-3.5 px-6 text-white rounded-xl font-bold transition-colors active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70',
                                unrepairable ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                            )}
                        >
                            {isPending && <Loader2 size={18} className="animate-spin" />}
                            {isPending ? 'Saving...' : unrepairable ? 'Write Off' : 'Return to Stock'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/**
 * Edits only the descriptive side of a repair. Item and quantity are absent by design:
 * they already moved stock, so correcting them means cancelling and re-sending.
 */
function EditRepairModal({ repair, onClose }: { repair: Repair; onClose: () => void }) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const asInputDate = (value: Date | string) => new Date(value).toISOString().split('T')[0];

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(null);

        startTransition(async () => {
            const result = await updateRepair(repair.id, formData);
            if ('error' in result && result.error) {
                setError(result.error);
                return;
            }
            onClose();
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold tracking-tight">Edit Repair</h3>
                            <p className="text-blue-100 text-sm mt-1">
                                {repair.item.name} · {repair.quantity} {repair.item.unit} out
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                            <X size={22} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
                    {error && (
                        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                Vendor / Workshop
                            </label>
                            <input
                                type="text"
                                name="vendor"
                                defaultValue={repair.vendor ?? ''}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                Contact Phone
                            </label>
                            <input
                                type="tel"
                                name="contactPhone"
                                defaultValue={repair.contactPhone ?? ''}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                Expected Return *
                            </label>
                            <DatePicker
                                name="expectedReturnDate"
                                value={asInputDate(repair.expectedReturnDate)}
                                className="py-3 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-blue-500/10 text-gray-700"
                            />
                            <p className="text-xs text-gray-400 mt-1.5">
                                Push this out if the vendor has agreed a new date.
                            </p>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                Estimated Cost
                            </label>
                            <input
                                type="number"
                                name="estimatedCost"
                                step="any"
                                min="0"
                                defaultValue={repair.estimatedCost ?? undefined}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                            What is wrong with it? *
                        </label>
                        <textarea
                            name="issueDescription"
                            required
                            rows={2}
                            defaultValue={repair.issueDescription}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                            Notes
                        </label>
                        <textarea
                            name="notes"
                            rows={2}
                            defaultValue={repair.notes ?? ''}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3.5 px-6 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors active:scale-[0.98]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-[2] py-3.5 px-6 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {isPending && <Loader2 size={18} className="animate-spin" />}
                            {isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function CancelRepairModal({ repair, onClose }: { repair: Repair; onClose: () => void }) {
    const [isPending, startTransition] = useTransition();
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleCancel = () => {
        setError(null);
        startTransition(async () => {
            const result = await cancelRepair(repair.id, reason);
            if ('error' in result && result.error) {
                setError(result.error);
                return;
            }
            onClose();
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">Cancel this repair?</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        All {repair.quantity} {repair.item.unit} of {repair.item.name} go straight back into stock.
                    </p>
                </div>

                <div className="p-6 space-y-4">
                    {error && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                            Reason *
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            autoFocus
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all placeholder:text-gray-400 resize-none"
                            placeholder="e.g., Sent in error, repaired in-house instead"
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors active:scale-[0.98]"
                        >
                            Keep Repair
                        </button>
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isPending || !reason.trim()}
                            className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isPending && <Loader2 size={16} className="animate-spin" />}
                            Cancel Repair
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
