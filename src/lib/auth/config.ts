import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { resolveRoleFromEmail } from './roles';

const googleClientId = process.env.GOOGLE_CLIENT_ID || 'missing-google-client-id';
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || 'missing-google-client-secret';

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || 'development-secret',
  session: {
    strategy: 'jwt',
  },
  providers: [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account || user) {
        token.role = resolveRoleFromEmail(user?.email || token.email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role || resolveRoleFromEmail(session.user.email);
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
};
