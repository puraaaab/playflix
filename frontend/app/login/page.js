"use client";

import { useRouter } from 'next/navigation';
import AuthForm from '../../components/AuthForm.js';

export default function LoginPage() {
  const router = useRouter();

  return (
    <AuthForm
      mode="login"
      onSuccess={() => {
        router.push('/browse');
        router.refresh();
      }}
    />
  );
}
