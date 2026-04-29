"use client";

import { useRouter } from 'next/navigation';
import AuthForm from '../../components/AuthForm.js';

export default function SignupPage() {
  const router = useRouter();

  return (
    <AuthForm
      mode="signup"
      onSuccess={() => {
        router.push('/browse');
        router.refresh();
      }}
    />
  );
}
