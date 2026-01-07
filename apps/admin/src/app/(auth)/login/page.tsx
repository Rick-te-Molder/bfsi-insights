'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type SubmitDeps = {
  email: string;
  password: string;
  setError: (value: string) => void;
  setLoading: (value: boolean) => void;
  supabase: ReturnType<typeof createClient>;
  router: ReturnType<typeof useRouter>;
};

function createSubmitHandler({
  email,
  password,
  setError,
  setLoading,
  supabase,
  router,
}: SubmitDeps) {
  return async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  };
}

function LoginHeader() {
  return (
    <header className="mb-6 text-center">
      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="text-2xl font-normal tracking-tight text-white">BFSI</span>
        <span className="text-sm font-bold uppercase text-sky-400">Admin</span>
      </div>
      <p className="text-sm text-neutral-400">Sign in to access the control tower</p>
    </header>
  );
}

type TextFieldProps = {
  id: string;
  label: string;
  type: 'email' | 'password';
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
};

function TextField({ id, label, type, value, placeholder, onChange }: Readonly<TextFieldProps>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-300 mb-1">
        {label}
      </label>
      <input
        type={type}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
      />
    </div>
  );
}

function ErrorBanner({ error }: Readonly<{ error: string }>) {
  if (!error) return null;
  return (
    <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
      {error}
    </div>
  );
}

function SubmitButton({ loading }: Readonly<{ loading: boolean }>) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-lg bg-sky-600 px-4 py-3 font-semibold text-white hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 transition"
    >
      {loading ? 'Signing in...' : 'Sign In'}
    </button>
  );
}

type LoginFieldsProps = {
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
};

function LoginFields({
  email,
  password,
  onEmailChange,
  onPasswordChange,
}: Readonly<LoginFieldsProps>) {
  return (
    <>
      <TextField
        id="email"
        label="Email"
        type="email"
        value={email}
        placeholder="admin@example.com"
        onChange={onEmailChange}
      />

      <TextField
        id="password"
        label="Password"
        type="password"
        value={password}
        placeholder="••••••••"
        onChange={onPasswordChange}
      />
    </>
  );
}

type LoginFormProps = {
  email: string;
  password: string;
  error: string;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
};

function LoginActions({ error, loading }: Readonly<{ error: string; loading: boolean }>) {
  return (
    <>
      <ErrorBanner error={error} />
      <SubmitButton loading={loading} />
    </>
  );
}

function LoginForm({
  email,
  password,
  error,
  loading,
  onSubmit,
  onEmailChange,
  onPasswordChange,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <LoginFields
        email={email}
        password={password}
        onEmailChange={onEmailChange}
        onPasswordChange={onPasswordChange}
      />
      <LoginActions error={error} loading={loading} />
    </form>
  );
}

function useLoginState() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  return { email, setEmail, password, setPassword, error, setError, loading, setLoading };
}

function buildSubmitDeps(args: {
  email: string;
  password: string;
  setError: (value: string) => void;
  setLoading: (value: boolean) => void;
  supabase: ReturnType<typeof createClient>;
  router: ReturnType<typeof useRouter>;
}): SubmitDeps {
  return {
    email: args.email,
    password: args.password,
    setError: args.setError,
    setLoading: args.setLoading,
    supabase: args.supabase,
    router: args.router,
  };
}

type LoginCardProps = {
  email: string;
  password: string;
  error: string;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
};

function LoginCard({
  email,
  password,
  error,
  loading,
  onSubmit,
  onEmailChange,
  onPasswordChange,
}: Readonly<LoginCardProps>) {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-8">
        <LoginHeader />
        <LoginForm
          email={email}
          password={password}
          error={error}
          loading={loading}
          onSubmit={onSubmit}
          onEmailChange={onEmailChange}
          onPasswordChange={onPasswordChange}
        />
      </div>
    </div>
  );
}

export default function LoginPage() {
  const login = useLoginState();
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = createSubmitHandler(
    buildSubmitDeps({
      email: login.email,
      password: login.password,
      setError: login.setError,
      setLoading: login.setLoading,
      supabase,
      router,
    }),
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <LoginCard
        email={login.email}
        password={login.password}
        error={login.error}
        loading={login.loading}
        onSubmit={handleSubmit}
        onEmailChange={login.setEmail}
        onPasswordChange={login.setPassword}
      />
    </div>
  );
}
