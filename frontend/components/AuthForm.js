"use client";

import { useState } from 'react';
import Link from 'next/link';
import api from '../lib/api.js';
import { bootstrapSecurityContext, hasSecurityPublicKey } from '../lib/security.js';

export default function AuthForm({ mode, onSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isSignup = mode === 'signup';

  async function handleSubmit(event) {
    event.preventDefault();
    console.log('[AuthForm] Form submitted');
    setLoading(true);
    setError('');

    try {
      // Ensure security context is ready before login
      await bootstrapSecurityContext();
      console.log('[PlayFlix][DEBUG] AuthForm hasSecurityPublicKey:', hasSecurityPublicKey());
      const payload = isSignup ? { name, email, password } : { email, password };
      const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login';
      console.log('[AuthForm] Sending request to', endpoint);
      const response = await api.post(endpoint, payload);
      console.log('[AuthForm] Request succeeded:', response.data);
      onSuccess?.();
    } catch (requestError) {
      console.error('[AuthForm] Request failed:', requestError);
      setError(requestError?.response?.data?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="playflix-shell flex min-h-[calc(100vh-88px)] items-center py-12">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-panel rounded-[32px] p-8">
          <div className="heading-font text-4xl font-bold text-white">{isSignup ? 'Join PlayFlix' : 'Welcome back'}</div>
          <p className="mt-4 text-sm leading-7 text-white/65">
            Sign in to continue watching, manage your membership, and pick up where you left off.
          </p>
          <div className="mt-8 space-y-3 text-sm text-white/72">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">Watch across TV, mobile, tablet, and desktop.</div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">Save favourites and continue from any device.</div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">Upgrade anytime with a quick Razorpay checkout.</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel rounded-[32px] p-8">
          <div className="heading-font text-3xl font-bold text-white">{isSignup ? 'Create account' : 'Sign in'}</div>
          <p className="mt-2 text-sm text-white/55">Fast login, clean checkout, and a streaming-first experience.</p>

          {error ? <div className="mt-5 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

          {isSignup ? (
            <label className="mt-6 block">
              <span className="mb-2 block text-sm text-white/65">Full name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} required className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-white/25" placeholder="Ariana Lane" />
            </label>
          ) : null}

          <label className="mt-6 block">
            <span className="mb-2 block text-sm text-white/65">Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-white/25" placeholder="user@playflix.io" />
          </label>

          <label className="mt-6 block">
            <span className="mb-2 block text-sm text-white/65">Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-white/25" placeholder="At least 8 characters" />
          </label>

          <button type="submit" disabled={loading} className="mt-8 w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? 'Working...' : isSignup ? 'Create account' : 'Login'}
          </button>

          <div className="mt-6 text-center text-sm text-white/55">
            {isSignup ? 'Already have an account? ' : "Need an account? "}
            <Link href={isSignup ? '/login' : '/signup'} className="font-semibold text-white hover:underline">
              {isSignup ? 'Login' : 'Signup'}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
