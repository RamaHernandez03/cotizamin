'use client';

import { signIn } from 'next-auth/react';

type Props = { className?: string };

export default function GoogleSignInButton({ className = '' }: Props) {
  const onClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    await signIn('google', { callbackUrl: '/dashboard/home' });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 font-medium ${className}`}
      style={{ color: '#00152F' }} // ← estático e idéntico en SSR/CSR
    >
      {/* SVG estático e idéntico en SSR/CSR */}
      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.1a6.99 6.99 0 0 1 0-4.2V7.06H2.18a11.02 11.02 0 0 0 0 9.88l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 4.73c1.61 0 3.06.55 4.2 1.64l3.15-3.15C17.45 1.3 14.97 0 12 0 7.7 0 3.99 2.47 2.18 6.06l3.66 2.84C6.71 6.3 9.14 4.73 12 4.73z"/>
      </svg>
      Continuar con Google
    </button>
  );
}
