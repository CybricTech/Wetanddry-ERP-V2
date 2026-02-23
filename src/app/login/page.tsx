import LoginForm from '@/components/auth/LoginForm';
import Image from 'next/image';

export default function LoginPage() {
    return (
        <main className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-200 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-grid-slate-200 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10 bg-[size:20px_20px]" />

            <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 md:p-10 relative z-10 backdrop-blur-sm">
                <div className="flex flex-col items-center mb-10">
                    <div className="relative w-48 h-24 mb-2 flex items-center justify-center">
                        <Image
                            src="/logo.png"
                            alt="Wet & Dry Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome Back</h1>
                    <p className="text-slate-500 mt-2 text-sm">Sign in to Wet&Dry ERP</p>
                </div>

                <LoginForm />
            </div>

            <div className="mt-8 text-center">
                <a
                    href="https://cybric.tech"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-400 font-medium tracking-wide uppercase hover:text-slate-600 transition-colors"
                >
                    Powered by Cybric Technologies
                </a>
            </div>
        </main>
    );
}
