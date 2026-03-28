import '../styles/globals.css';

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
      <body>{children}</body>
    </html>
  );
}
