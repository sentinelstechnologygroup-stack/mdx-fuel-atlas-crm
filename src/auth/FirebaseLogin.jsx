// src/auth/FirebaseLogin.jsx
import React, { useState } from 'react';
import { Fuel, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/auth/AuthContext';

export default function FirebaseLogin() {
  const {
    authError,
    isLoadingAuth,
    login,
    requestPasswordReset,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError('');
    setResetMessage('');

    if (!email.trim() || !password) {
      setLocalError('Enter your employee email and password.');
      return;
    }

    try {
      await login(email, password);
    } catch (error) {
      setLocalError(
        error?.message || 'Unable to sign in. Check your credentials.'
      );
    }
  };

  const handlePasswordReset = async () => {
    setLocalError('');
    setResetMessage('');

    if (!email.trim()) {
      setLocalError('Enter your employee email before requesting a reset.');
      return;
    }

    setIsResetting(true);

    try {
      await requestPasswordReset(email);
      setResetMessage(
        'If the account is eligible, a password reset email has been sent.'
      );
    } catch {
      setResetMessage(
        'If the account is eligible, a password reset email has been sent.'
      );
    } finally {
      setIsResetting(false);
    }
  };

  const displayedError = localError || authError?.message;

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.28),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(6,182,212,0.20),_transparent_42%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <Card className="w-full max-w-md border-slate-700/70 bg-slate-900/90 text-white shadow-2xl shadow-blue-950/40 backdrop-blur-xl">
          <CardHeader className="space-y-5 pb-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-cyan-500/20">
              <Fuel className="h-8 w-8 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-400">
                MDX Fuel
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                ATLAS CRM
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Sign in with your authorized employee account.
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {displayedError && (
              <Alert className="border-rose-500/40 bg-rose-500/10 text-rose-100">
                <AlertDescription>{displayedError}</AlertDescription>
              </Alert>
            )}

            {resetMessage && (
              <Alert className="border-emerald-500/40 bg-emerald-500/10 text-emerald-100">
                <AlertDescription>{resetMessage}</AlertDescription>
              </Alert>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="employee-email" className="text-slate-200">
                  Employee email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="employee-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-12 border-slate-700 bg-slate-950/70 pl-10 text-white placeholder:text-slate-600"
                    placeholder="name@mdxfuel.com"
                    disabled={isLoadingAuth}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employee-password" className="text-slate-200">
                  Password
                </Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="employee-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 border-slate-700 bg-slate-950/70 pl-10 text-white placeholder:text-slate-600"
                    placeholder="Enter your password"
                    disabled={isLoadingAuth}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="h-12 w-full bg-gradient-to-r from-blue-600 to-cyan-500 font-semibold text-white hover:from-blue-500 hover:to-cyan-400"
                disabled={isLoadingAuth}
              >
                {isLoadingAuth ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-slate-400 hover:bg-slate-800 hover:text-cyan-300"
              onClick={handlePasswordReset}
              disabled={isLoadingAuth || isResetting}
            >
              {isResetting ? 'Sending reset email…' : 'Forgot password?'}
            </Button>

            <p className="text-center text-xs text-slate-500">
              Access is restricted to active MDX Fuel employee accounts.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
