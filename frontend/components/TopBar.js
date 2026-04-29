"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import api from '../lib/api.js';

const links = [
  { href: '/', label: 'Home' },
  { href: '/browse', label: 'Browse' },
  { href: '/plans', label: 'Plans' },
  { href: '/account', label: 'Account' }
];

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const response = await api.get('/api/auth/me');
        if (mounted) {
          setUser(response.data.user);
        }
      } catch {
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setReady(true);
        }
      }
    }

    loadUser();
    return () => {
      mounted = false;
    };
  }, [pathname]);

  async function handleLogout() {
    await api.post('/api/auth/logout', {});
    setUser(null);
    router.push('/');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-2xl">
      <div className="playflix-shell flex items-center justify-between gap-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e50914] text-sm font-bold text-white shadow-lg shadow-[#e5091422]">
            P
          </span>
          <div>
            <div className="heading-font text-lg font-bold tracking-wide">PlayFlix</div>
            <div className="text-xs uppercase tracking-[0.25em] text-white/45">OTT streaming</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 text-sm transition ${active ? 'bg-white text-black' : 'text-white/72 hover:bg-white/10 hover:text-white'}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {ready && user ? (
            <>
              <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 sm:block">
                {user.name} · {user.role}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Logout
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
                Login
              </Link>
              <Link href="/signup" className="rounded-full bg-[#e50914] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110">
                Start Free
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
