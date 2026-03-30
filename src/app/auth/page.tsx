'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { MotionButton } from '@/components/ui/motion-button';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

type AuthMode = 'signin' | 'signup';

const MIN_PASSWORD_LENGTH = 6;

function resolveLocale() {
    if (typeof navigator === 'undefined') {
        return 'zh-CN';
    }

    return navigator.language?.startsWith('zh') ? 'zh-CN' : navigator.language || 'en-US';
}

function isSafeRedirectPath(path: string | null): path is string {
    return Boolean(path && path.startsWith('/') && !path.startsWith('//'));
}

function mapCallbackError(errorCode: string | null, locale: string) {
    const isChinese = locale.startsWith('zh');

    switch (errorCode) {
        case 'config':
            return isChinese
                ? 'Supabase 配置缺失，请先完成环境变量配置。'
                : 'Supabase configuration is missing.';
        case 'missing_code':
            return isChinese
                ? '登录回调缺少授权信息，请重试。'
                : 'Missing authorization code in callback. Please try again.';
        case 'oauth_failed':
            return isChinese
                ? 'Google 登录失败，请重试。'
                : 'Google sign-in failed. Please try again.';
        default:
            return null;
    }
}

export default function AuthPage() {
    const router = useRouter();
    const supabase = getSupabaseClient();
    const configured = isSupabaseConfigured();
    const [mode, setMode] = useState<AuthMode>('signin');
    const [locale, setLocale] = useState('zh-CN');
    const [nextPath, setNextPath] = useState('/');
    const [callbackErrorCode, setCallbackErrorCode] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);

    const isChinese = locale.startsWith('zh');

    useEffect(() => {
        setLocale(resolveLocale());
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const requestedPath = params.get('next');
        setNextPath(isSafeRedirectPath(requestedPath) ? requestedPath : '/');
        setCallbackErrorCode(params.get('error'));
    }, []);

    useEffect(() => {
        const callbackError = mapCallbackError(callbackErrorCode, locale);
        if (callbackError) {
            setErrorMessage(callbackError);
        }
    }, [callbackErrorCode, locale]);

    useEffect(() => {
        if (!supabase) {
            return;
        }

        let active = true;
        void supabase.auth.getUser().then(({ data }) => {
            if (active && data.user) {
                router.replace(nextPath);
            }
        });

        return () => {
            active = false;
        };
    }, [nextPath, router, supabase]);

    async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!supabase) {
            setErrorMessage(isChinese ? 'Supabase 尚未配置。' : 'Supabase is not configured.');
            return;
        }

        if (password.length < MIN_PASSWORD_LENGTH) {
            setErrorMessage(
                isChinese
                    ? `密码长度至少 ${MIN_PASSWORD_LENGTH} 位。`
                    : `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
            );
            return;
        }

        if (mode === 'signup' && password !== confirmPassword) {
            setErrorMessage(isChinese ? '两次输入的密码不一致。' : 'Passwords do not match.');
            return;
        }

        setBusy(true);
        setErrorMessage(null);
        setInfoMessage(null);

        try {
            if (mode === 'signin') {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) {
                    throw error;
                }

                router.replace(nextPath);
                return;
            }

            const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: redirectTo,
                },
            });

            if (error) {
                throw error;
            }

            if (data.session) {
                router.replace(nextPath);
                return;
            }

            setInfoMessage(
                isChinese
                    ? '注册成功，请前往邮箱点击确认链接后再登录。'
                    : 'Sign-up succeeded. Please verify your email link before signing in.'
            );
            setMode('signin');
            setConfirmPassword('');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : isChinese ? '操作失败，请重试。' : 'Request failed. Please retry.');
        } finally {
            setBusy(false);
        }
    }

    async function handleGoogleSignIn() {
        if (!supabase) {
            setErrorMessage(isChinese ? 'Supabase 尚未配置。' : 'Supabase is not configured.');
            return;
        }

        setBusy(true);
        setErrorMessage(null);
        setInfoMessage(null);

        try {
            const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                },
            });

            if (error) {
                throw error;
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : isChinese ? 'Google 登录失败。' : 'Google sign-in failed.');
            setBusy(false);
        }
    }

    if (!configured || !supabase) {
        return (
            <main className="landing-shell">
                <div className="landing-shell__glow" />
                <section className="landing-card">
                    <h1 className="landing-card__title">Supabase configuration required.</h1>
                    <p className="landing-card__body">
                        Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY first.
                    </p>
                </section>
            </main>
        );
    }

    return (
        <main className="landing-shell auth-shell">
            <div className="landing-shell__glow" />
            <section className="auth-card">
                <p className="auth-card__eyebrow">Orbit Planner</p>
                <h1 className="auth-card__title">{isChinese ? '登录你的账号' : 'Sign in to Orbit Planner'}</h1>
                <p className="auth-card__subtitle">
                    {isChinese
                        ? '支持邮箱密码和 Google 登录。'
                        : 'Use email/password or continue with Google.'}
                </p>

                <div className="auth-card__modes" role="tablist" aria-label="auth mode">
                    <MotionButton
                        aria-selected={mode === 'signin'}
                        className={`auth-card__mode ${mode === 'signin' ? 'is-active' : ''}`}
                        motionPreset="subtle"
                        onClick={() => setMode('signin')}
                        role="tab"
                        type="button"
                    >
                        {isChinese ? '登录' : 'Sign in'}
                    </MotionButton>
                    <MotionButton
                        aria-selected={mode === 'signup'}
                        className={`auth-card__mode ${mode === 'signup' ? 'is-active' : ''}`}
                        motionPreset="subtle"
                        onClick={() => setMode('signup')}
                        role="tab"
                        type="button"
                    >
                        {isChinese ? '注册' : 'Sign up'}
                    </MotionButton>
                </div>

                <form className="auth-card__form" onSubmit={(event) => void handleEmailAuth(event)}>
                    <label className="auth-card__label">
                        {isChinese ? '邮箱' : 'Email'}
                        <input
                            autoComplete="email"
                            className="auth-card__input"
                            onChange={(event) => setEmail(event.target.value.trim())}
                            placeholder="you@example.com"
                            required
                            type="email"
                            value={email}
                        />
                    </label>

                    <label className="auth-card__label">
                        {isChinese ? '密码' : 'Password'}
                        <input
                            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                            className="auth-card__input"
                            minLength={MIN_PASSWORD_LENGTH}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                            type="password"
                            value={password}
                        />
                    </label>

                    {mode === 'signup' ? (
                        <label className="auth-card__label">
                            {isChinese ? '确认密码' : 'Confirm password'}
                            <input
                                autoComplete="new-password"
                                className="auth-card__input"
                                minLength={MIN_PASSWORD_LENGTH}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                required
                                type="password"
                                value={confirmPassword}
                            />
                        </label>
                    ) : null}

                    {errorMessage ? <p className="auth-card__error">{errorMessage}</p> : null}
                    {infoMessage ? <p className="auth-card__success">{infoMessage}</p> : null}

                    <div className="auth-card__actions">
                        <MotionButton className="planner-button auth-card__submit" disabled={busy} type="submit">
                            {busy
                                ? isChinese
                                    ? '处理中...'
                                    : 'Processing...'
                                : mode === 'signin'
                                    ? isChinese
                                        ? '邮箱登录'
                                        : 'Sign in with Email'
                                    : isChinese
                                        ? '注册账号'
                                        : 'Create account'}
                        </MotionButton>

                        <MotionButton
                            className="planner-button planner-button--ghost auth-card__google"
                            disabled={busy}
                            onClick={() => void handleGoogleSignIn()}
                            type="button"
                        >
                            Google
                        </MotionButton>
                    </div>
                </form>

                <div className="auth-card__links">
                    <Link className="auth-card__link" href="/auth/reset">
                        {isChinese ? '忘记密码？' : 'Forgot password?'}
                    </Link>
                </div>
            </section>
        </main>
    );
}
