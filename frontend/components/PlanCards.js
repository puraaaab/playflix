"use client";

import { useState } from 'react';
import api from '../lib/api.js';

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';

function loadRazorpayScript() {
  return new Promise((resolve) => {
    const existing = document.querySelector('script[data-razorpay="true"]');
    if (existing) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpay = 'true';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PlanCards({ plans }) {
  const [busyPlan, setBusyPlan] = useState(null);

  async function handleSubscribe(planCode) {
    setBusyPlan(planCode);
    try {
      const { data } = await api.post('/api/payments/create-order', { planCode });
      if (data.provider !== 'razorpay') {
        throw new Error('Razorpay is not configured on the backend yet. Restart the backend after setting RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env.');
      }
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || typeof window.Razorpay === 'undefined') {
        throw new Error('Razorpay checkout script could not be loaded.');
      }

      const checkoutKey = RAZORPAY_KEY_ID || data.razorpayKeyId;
      if (!checkoutKey || checkoutKey === 'rzp_test_placeholder') {
        throw new Error('Razorpay public key is missing.');
      }

      const checkout = new window.Razorpay({
        key: checkoutKey,
        amount: data.order.amount,
        currency: data.order.currency,
        name: 'PlayFlix',
        description: `${data.plan.name} subscription`,
        order_id: data.order.id,
        notes: { planCode },
        method: {
          card: true,
          netbanking: true,
          wallet: true,
          upi: true,
          emi: false,
          paylater: false
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: 'UPI',
                instruments: [{ method: 'upi' }]
              },
              card: {
                name: 'Cards',
                instruments: [{ method: 'card' }]
              },
              netbanking: {
                name: 'Netbanking',
                instruments: [{ method: 'netbanking' }]
              },
              wallet: {
                name: 'Wallets',
                instruments: [{ method: 'wallet' }]
              }
            },
            sequence: ['block.upi', 'block.card', 'block.netbanking', 'block.wallet'],
            preferences: {
              show_default_blocks: true
            }
          }
        },
        theme: { color: '#e50914' },
        modal: {
          ondismiss: () => {
            setBusyPlan(null);
          }
        },
        handler: async (response) => {
          try {
            await api.post('/api/payments/verify', {
              planCode,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });
            window.location.href = '/browse';
          } catch (verifyError) {
            alert(verifyError?.response?.data?.message || verifyError.message || 'Payment verification failed.');
          }
        }
      });

      checkout.on('payment.failed', (response) => {
        alert(response?.error?.description || 'Payment failed. Please try again.');
      });

      checkout.open();
    } catch (error) {
      alert(error?.response?.data?.message || error.message || 'Subscription failed.');
    } finally {
      setBusyPlan(null);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {plans.map((plan) => (
        <article key={plan.code} className={`rounded-[30px] border p-6 transition duration-300 hover:-translate-y-1 ${plan.code === 'premium' ? 'border-[#e50914]/40 bg-[#e5091414]' : 'border-white/10 bg-white/[0.04]'}`}>
          <div className="flex items-center justify-between">
            <div className="heading-font text-2xl font-bold text-white">{plan.name}</div>
            <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/60">
              {plan.code}
            </div>
          </div>
          <div className="mt-5 flex items-end gap-2">
            <div className="heading-font text-4xl font-bold text-white">₹{plan.price}</div>
            <div className="pb-1 text-sm text-white/55">/month</div>
          </div>
          <p className="mt-3 text-sm text-white/65">{plan.description}</p>
          <ul className="mt-5 space-y-3 text-sm text-white/80">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs text-white">✓</span>
                {feature}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busyPlan === plan.code}
            onClick={() => handleSubscribe(plan.code)}
            className="mt-6 w-full rounded-full bg-[#e50914] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyPlan === plan.code ? 'Opening checkout...' : 'Subscribe now'}
          </button>
        </article>
      ))}
    </div>
  );
}
