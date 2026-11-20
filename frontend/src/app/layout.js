import './globals.css';

export const metadata = {
  title: 'DevOps Frontend',
  description: 'Frontend Web Application',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
