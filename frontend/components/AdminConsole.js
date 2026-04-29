"use client";

import api from '../lib/api.js';
import { useEffect, useState } from 'react';

export default function AdminConsole() {
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadAdminData() {
      try {
        const [userResponse, paymentResponse] = await Promise.all([
          api.get('/api/admin/users'),
          api.get('/api/admin/payments')
        ]);
        if (!mounted) {
          return;
        }
        setUsers(userResponse.data.users || []);
        setPayments(paymentResponse.data.payments || []);
      } catch (requestError) {
        if (mounted) {
          setError(requestError?.response?.data?.message || 'Admin data could not be loaded.');
        }
      }
    }

    loadAdminData();
    return () => {
      mounted = false;
    };
  }, []);

  async function promoteUser(userId, role) {
    await api.patch(`/api/admin/users/${userId}/role`, { role });
    const response = await api.get('/api/admin/users');
    setUsers(response.data.users || []);
  }

  return (
    <div className="space-y-8">
      {error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}

      <section className="glass-panel rounded-[28px] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="heading-font text-2xl font-bold text-white">Users</h2>
            <p className="text-sm text-white/55">Review roles and subscription state.</p>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-white/50">
              <tr>
                <th className="py-3 pr-4">Name</th>
                <th className="py-3 pr-4">Email</th>
                <th className="py-3 pr-4">Role</th>
                <th className="py-3 pr-4">Plan</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-white/8 text-white/85">
                  <td className="py-3 pr-4">{user.name}</td>
                  <td className="py-3 pr-4">{user.email}</td>
                  <td className="py-3 pr-4 capitalize">{user.role}</td>
                  <td className="py-3 pr-4 capitalize">{user.subscription_plan}</td>
                  <td className="py-3 pr-4 capitalize">{user.subscription_status}</td>
                  <td className="py-3 pr-4">
                    <button
                      type="button"
                      className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
                      onClick={() => promoteUser(user.id, user.role === 'admin' ? 'user' : 'admin')}
                    >
                      Toggle Role
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-panel rounded-[28px] p-6">
        <h2 className="heading-font text-2xl font-bold text-white">Payments</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {payments.map((payment) => (
            <article key={payment.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-white">{payment.email || `User ${payment.user_id}`}</div>
                  <div className="text-xs uppercase tracking-[0.3em] text-white/45">{payment.plan_code}</div>
                </div>
                <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-white/60">
                  {payment.status}
                </div>
              </div>
              <div className="mt-4 text-sm text-white/70">₹{payment.amount_paise / 100} · {payment.currency}</div>
              <div className="mt-2 break-all text-xs text-white/45">Order {payment.razorpay_order_id}</div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
