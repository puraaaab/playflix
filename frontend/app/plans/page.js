"use client";

import { useEffect, useState } from 'react';
import api from '../../lib/api.js';
import PlanCards from '../../components/PlanCards.js';

export default function PlansPage() {
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    let mounted = true;

    api.get('/api/payments/plans').then((response) => {
      if (mounted) {
        setPlans(response.data.plans || []);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="playflix-shell py-8 md:py-12">
      <div className="overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-8 md:p-10">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-white/55">Membership</div>
          <h1 className="heading-font mt-4 text-4xl font-bold text-white md:text-5xl">Choose the plan that fits your screens</h1>
          <p className="mt-4 text-sm leading-7 text-white/62">
            Razorpay opens in test mode with the public key id only. The backend creates orders and verifies payment signatures.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <PlanCards plans={plans} />
      </div>
    </div>
  );
}
