import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { resolveRoleFromEmail } from './roles';

const googleClientId = process.env.GOOGLE_CLIENT_ID || 'missing-google-client-id';
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || 'missing-google-client-secret';
const e2eAuthEnabled = process.env.E2E_AUTH_ENABLED === '1';

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
    ...(e2eAuthEnabled
      ? [
          CredentialsProvider({
            name: 'E2E Credentials',
            credentials: {
              email: { label: 'Email', type: 'email' },
              name: { label: 'Name', type: 'text' },
            },
            async authorize(credentials) {
              const email = credentials?.email?.trim().toLowerCase();
              if (!email) {
                return null;
              }

              return {
                id: email,
                email,
                name: credentials?.name?.trim() || email,
                role: resolveRoleFromEmail(email),
              };
            },
          }),
        ]
      : []),
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
