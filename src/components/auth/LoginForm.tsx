'use client';

import { useActionState } from 'react';
import { authenticate } from '@/lib/actions/auth';
import { motion } from 'framer-motion';
import { Loader2, ArrowRight } from 'lucide-react';

export default function LoginForm() {
    const [errorMessage, formAction, isPending] = useActionState(
        authenticate,
        undefined,
    );

    return (
        <form action={formAction} className="space-y-6">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                        id="email"
                        type="email"
                        name="email"
                        placeholder="Enter your email"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                        id="password"
                        type="password"
                        name="password"
                        placeholder="••••••••"
                        required
                        minLength={6}
                    />
                </div>
            </div>

            {errorMessage && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg"
                >
                    {errorMessage}
                </motion.div>
            )}

            <button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-disabled={isPending}
                disabled={isPending}
            >
                {isPending ? (
                    <>
                        <Loader2 className="animate-spin" size={20} />
                        Signing in...
                    </>
                ) : (
                    <>
                        Sign In <ArrowRight size={20} />
                    </>
                )}
            </button>


        </form>
    );
}
