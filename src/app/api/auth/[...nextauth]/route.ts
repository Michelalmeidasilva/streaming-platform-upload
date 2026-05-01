import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth/config';

const handler = NextAuth(authOptions);

function syncDevAuthOrigin() {
  if (process.env.NODE_ENV === 'development') {
    process.env.AUTH_TRUST_HOST = 'true';
  }
}

export async function GET(request: Request, context: unknown) {
  syncDevAuthOrigin();
  return handler(request, context);
}

export async function POST(request: Request, context: unknown) {
  syncDevAuthOrigin();
  return handler(request, context);
}
