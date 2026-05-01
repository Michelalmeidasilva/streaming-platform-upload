import { DefaultSession } from 'next-auth';
import type { UserRole } from '@/types';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      role: UserRole;
    };
  }

  interface User {
    role?: UserRole;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: UserRole;
  }
}

export {};
