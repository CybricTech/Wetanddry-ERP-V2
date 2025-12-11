'use client';

import { useState, useMemo } from 'react';
import { createUser } from '@/lib/actions/users';
import { Role } from '@/lib/permissions';
import { X, Eye, EyeOff, UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CreateUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (user: any) => void;
}

// Password strength calculation
function getPasswordStrength(password: string): { level: number; label: string; color: string } {
    if (!password) return { level: 0, label: '', color: 'bg-gray-200' };
    if (password.length < 6) return { level: 1, label: 'Too short', color: 'bg-red-500' };

    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 1) return { level: 2, label: 'Weak', color: 'bg-red-500' };
    if (score === 2) return { level: 3, label: 'Fair', color: 'bg-yellow-500' };
    if (score === 3) return { level: 4, label: 'Good', color: 'bg-blue-500' };
    return { level: 5, label: 'Strong', color: 'bg-green-500' };
}

export default function CreateUserModal({ isOpen, onClose, onSuccess }: CreateUserModalProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<string>(Role.STOREKEEPER);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const roles = Object.values(Role);
    const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const result = await createUser({ name, email, password, role });
            if (result.success) {
                toast.success(`User "${name}" created successfully!`);
                onSuccess(result.data);
                // Reset form
                setName('');
                setEmail('');
                setPassword('');
                setRole(Role.STOREKEEPER);
                onClose();
            } else {
                setError(result.error || 'Failed to create user');
            }
        } catch (err) {
            console.error(err);
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setError(null);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <UserPlus className="text-blue-600" size={20} />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900">Create New User</h2>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={loading}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Name Field */}
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                            Full Name
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            minLength={2}
                            disabled={loading}
                            placeholder="John Doe"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        />
                    </div>

                    {/* Email Field */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                            Email Address
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                            placeholder="john@wetndry.com"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        />
                    </div>

                    {/* Password Field with Strength Indicator */}
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                disabled={loading}
                                placeholder="Min. 6 characters"
                                className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                {showPassword ? (
                                    <EyeOff size={18} className="text-gray-400" />
                                ) : (
                                    <Eye size={18} className="text-gray-400" />
                                )}
                            </button>
                        </div>
                        {/* Password Strength Indicator */}
                        {password && (
                            <div className="mt-2">
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map((level) => (
                                        <div
                                            key={level}
                                            className={`h-1 flex-1 rounded-full transition-all ${level <= passwordStrength.level ? passwordStrength.color : 'bg-gray-200'
                                                }`}
                                        />
                                    ))}
                                </div>
                                <p className={`text-xs mt-1 ${passwordStrength.level <= 2 ? 'text-red-600' :
                                        passwordStrength.level === 3 ? 'text-yellow-600' :
                                            passwordStrength.level === 4 ? 'text-blue-600' :
                                                'text-green-600'
                                    }`}>
                                    {passwordStrength.label}
                                    {passwordStrength.level >= 2 && passwordStrength.level < 5 && (
                                        <span className="text-gray-500"> — Try adding {
                                            passwordStrength.level === 2 ? 'uppercase letters' :
                                                passwordStrength.level === 3 ? 'numbers' :
                                                    'special characters (!@#$)'
                                        }</span>
                                    )}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Role Field */}
                    <div>
                        <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1.5">
                            Role
                        </label>
                        <select
                            id="role"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            disabled={loading}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white disabled:bg-gray-50 disabled:text-gray-500"
                        >
                            {roles.map((r) => (
                                <option key={r} value={r}>
                                    {r}
                                </option>
                            ))}
                        </select>
                        <p className="mt-1.5 text-xs text-gray-500">
                            {role === Role.SUPER_ADMIN && 'Full system access'}
                            {role === Role.MANAGER && 'Operational oversight & approvals'}
                            {role === Role.STOREKEEPER && 'Day-to-day operations'}
                            {role === Role.ACCOUNTANT && 'Financial visibility only'}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <UserPlus size={18} />
                                    Create User
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

