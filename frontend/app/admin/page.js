"use client";

import AdminConsole from '../../components/AdminConsole.js';

export default function AdminPage() {
  return (
    <div className="playflix-shell py-8 md:py-12">
      <div className="glass-panel rounded-[36px] p-8 md:p-10">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-white/55">Studio tools</div>
          <h1 className="heading-font mt-4 text-4xl font-bold text-white md:text-5xl">Content and membership control</h1>
          <p className="mt-4 text-sm leading-7 text-white/62">This internal page is hidden from the main navigation and is only for staff operations.</p>
        </div>
      </div>

      <div className="mt-8">
        <AdminConsole />
      </div>
    </div>
  );
}
