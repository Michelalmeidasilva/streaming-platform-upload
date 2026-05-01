import '../styles/globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Streaming Platform Upload',
  description: 'Upload and manage your videos',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
