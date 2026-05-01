import './globals.css';
import TopBar from '../components/TopBar.js';
import { cookies } from 'next/headers';

export const metadata = {
  title: 'PlayFlix',
  description: 'PlayFlix is a Netflix-inspired OTT experience with bold discovery, memberships, and premium streaming.'
};

async function getSecurityContext() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4000';
  try {
    const res = await fetch(`${baseUrl}/api/security/bootstrap`, {
      cache: 'no-store'
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    return null;
  }
}

export default async function RootLayout({ children }) {
  cookies(); // Opt into dynamic rendering
  const securityContext = await getSecurityContext();

  return (
    <html lang="en">
      <head>
        {securityContext && (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__PLAYFLIX_SECURITY__ = ${JSON.stringify({
                sessionId: securityContext.sessionId,
                sessionKey: securityContext.sessionKey,
                publicKey: securityContext.publicKey,
                csrfToken: securityContext.csrfToken
              })};`
            }}
          />
        )}
      </head>
      <body>
        <TopBar />
        <main>{children}</main>
      </body>
    </html>
  );
}
