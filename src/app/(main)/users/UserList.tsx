'use client';

import { useState } from 'react';
import { updateUserRole, deleteUser, changeUserPassword } from '@/lib/actions/users';
import { Role } from '@/lib/permissions';
import { Trash2, Edit2, Check, X, Shield, UserPlus, Key, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import CreateUserModal from './CreateUserModal';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt?: string;
}

const roleColors: Record<string, string> = {
    'Super Admin': 'bg-purple-100 text-purple-700 border-purple-200',
    'Manager': 'bg-blue-100 text-blue-700 border-blue-200',
    'Storekeeper': 'bg-green-100 text-green-700 border-green-200',
    'Accountant': 'bg-amber-100 text-amber-700 border-amber-200',
};

export default function UserList({ initialUsers }: { initialUsers: User[] }) {
    const [users, setUsers] = useState<User[]>(initialUsers);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [passwordModal, setPasswordModal] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
    const [newPassword, setNewPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    const roles = Object.values(Role);

    const handleEditClick = (user: User) => {
        setEditingId(user.id);
        setSelectedRole(user.role);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setSelectedRole('');
    };

    const handleSaveRole = async (userId: string) => {
        if (!selectedRole) return;
        setLoading(true);
        try {
            const result = await updateUserRole(userId, selectedRole);
            if (result.success) {
                setUsers(users.map(u => u.id === userId ? { ...u, role: selectedRole } : u));
                setEditingId(null);
                toast.success('Role updated successfully');
            } else {
                toast.error('Failed to update role: ' + result.error);
            }
        } catch (error) {
            console.error(error);
            toast.error('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

        setLoading(true);
        try {
            const result = await deleteUser(userId);
            if (result.success) {
                setUsers(users.filter(u => u.id !== userId));
                toast.success('User deleted successfully');
            } else {
                toast.error('Failed to delete user: ' + result.error);
            }
        } catch (error) {
            console.error(error);
            toast.error('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleUserCreated = (newUser: User) => {
        setUsers([...users, newUser].sort((a, b) => a.name.localeCompare(b.name)));
    };

    const handlePasswordChange = async () => {
        if (!passwordModal.user || !newPassword) return;
        if (newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setChangingPassword(true);
        try {
            const result = await changeUserPassword(passwordModal.user.id, newPassword);
            if (result.success) {
                toast.success(`Password changed for ${passwordModal.user.name}`);
                setPasswordModal({ open: false, user: null });
                setNewPassword('');
            } else {
                toast.error('Failed to change password: ' + result.error);
            }
        } catch (error) {
            console.error(error);
            toast.error('An unexpected error occurred');
        } finally {
            setChangingPassword(false);
        }
    };

    return (
        <>
            {/* Action Bar */}
            <div className="flex justify-end mb-4">
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-500/25"
                >
                    <UserPlus size={20} />
                    Add User
                </button>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                                <div className="text-sm text-gray-500">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {editingId === user.id ? (
                                            <select
                                                value={selectedRole}
                                                onChange={(e) => setSelectedRole(e.target.value)}
                                                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                                disabled={loading}
                                            >
                                                {roles.map(role => (
                                                    <option key={role} value={role}>{role}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${roleColors[user.role] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                                <Shield size={12} className="mr-1" />
                                                {user.role}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end space-x-2">
                                            {editingId === user.id ? (
                                                <>
                                                    <button
                                                        onClick={() => handleSaveRole(user.id)}
                                                        disabled={loading}
                                                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                        title="Save"
                                                    >
                                                        <Check size={18} />
                                                    </button>
                                                    <button
                                                        onClick={handleCancelEdit}
                                                        disabled={loading}
                                                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                                        title="Cancel"
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleEditClick(user)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Edit Role"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => { setPasswordModal({ open: true, user }); setNewPassword(''); }}
                                                        className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                        title="Change Password"
                                                    >
                                                        <Key size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(user.id)}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete User"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {users.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        No users found. Click "Add User" to create one.
                    </div>
                )}
            </div>

            {/* Create User Modal */}
            <CreateUserModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={handleUserCreated}
            />

            {/* Change Password Modal */}
            {passwordModal.open && passwordModal.user && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 bg-gradient-to-r from-amber-500 to-amber-600 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Key size={24} />
                                    <h3 className="text-xl font-bold">Change Password</h3>
                                </div>
                                <button
                                    onClick={() => setPasswordModal({ open: false, user: null })}
                                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <p className="text-amber-100 mt-2 text-sm">
                                Set a new password for {passwordModal.user.name}
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    New Password *
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                                    placeholder="Enter new password (min 6 characters)"
                                    minLength={6}
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setPasswordModal({ open: false, user: null })}
                                    className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePasswordChange}
                                    disabled={changingPassword || newPassword.length < 6}
                                    className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-medium hover:from-amber-600 hover:to-amber-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {changingPassword && <Loader2 size={18} className="animate-spin" />}
                                    {changingPassword ? 'Changing...' : 'Change Password'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
