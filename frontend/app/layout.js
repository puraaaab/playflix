import './globals.css';
import TopBar from '../components/TopBar.js';

export const metadata = {
  title: 'PlayFlix',
  description: 'PlayFlix is a Netflix-inspired OTT experience with bold discovery, memberships, and premium streaming.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <TopBar />
        <main>{children}</main>
      </body>
    </html>
  );
}
