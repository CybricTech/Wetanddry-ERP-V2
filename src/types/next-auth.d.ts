import NextAuth, { DefaultSession } from 'next-auth';
import { Permission, Role } from '@/lib/permissions';

declare module 'next-auth' {
    interface Session {
        user: {
            role: string;
            // Resolved server-side in the session callback. The browser has no
            // database access, so client components read this rather than
            // calling hasPermission directly.
            permissions: Permission[];
        } & DefaultSession['user'];
    }

    interface User {
        role: string;
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        role: string;
    }
}
