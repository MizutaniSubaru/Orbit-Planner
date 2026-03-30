'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import { MotionButton } from '@/components/ui/motion-button';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

function resolveLocale() {
    if (typeof navigator === 'undefined') {
        return 'zh-CN';
    }

    return navigator.language?.startsWith('zh') ? 'zh-CN' : navigator.language || 'en-US';
}

export default function ResetPasswordPage() {
    const supabase = getSupabaseClient();
    const configured = isSupabaseConfigured();
    const [locale, setLocale] = useState('zh-CN');
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);

    const isChinese = locale.startsWith('zh');

    useEffect(() => {
        setLocale(resolveLocale());
    }, []);

    async function handleReset(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!supabase) {
            setErrorMessage(isChinese ? 'Supabase 尚未配置。' : 'Supabase is not configured.');
            return;
        }

        setBusy(true);
        setErrorMessage(null);
        setInfoMessage(null);

        try {
            const redirectTo = `${window.location.origin}/auth/update-password`;
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo,
            });

            if (error) {
                throw error;
            }

            setInfoMessage(
                isChinese
                    ? '重置邮件已发送，请检查邮箱并点击链接修改密码。'
                    : 'Recovery email sent. Check your inbox to continue.'
            );
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : isChinese ? '发送失败，请重试。' : 'Failed to send recovery email.');
        } finally {
            setBusy(false);
        }
    }

    if (!configured || !supabase) {
        return (
            <main className="landing-shell">
                <div className="landing-shell__glow" />
                <section className="landing-card">
                    <h1 className="landing-card__title">Supabase configuration required.</h1>
                    <p className="landing-card__body">Please configure Supabase first.</p>
                </section>
            </main>
        );
    }

    return (
        <main className="landing-shell auth-shell">
            <div className="landing-shell__glow" />
            <section className="auth-card auth-card--narrow">
                <h1 className="auth-card__title">{isChinese ? '重置密码' : 'Reset Password'}</h1>
                <p className="auth-card__subtitle">
                    {isChinese
                        ? '输入注册邮箱，我们会发送密码重置链接。'
                        : 'Enter your email and we will send a recovery link.'}
                </p>

                <form className="auth-card__form" onSubmit={(event) => void handleReset(event)}>
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

                    {errorMessage ? <p className="auth-card__error">{errorMessage}</p> : null}
                    {infoMessage ? <p className="auth-card__success">{infoMessage}</p> : null}

                    <div className="auth-card__actions">
                        <MotionButton className="planner-button auth-card__submit" disabled={busy} type="submit">
                            {busy
                                ? isChinese
                                    ? '发送中...'
                                    : 'Sending...'
                                : isChinese
                                    ? '发送重置链接'
                                    : 'Send reset link'}
                        </MotionButton>
                    </div>
                </form>

                <div className="auth-card__links">
                    <Link className="auth-card__link" href="/auth">
                        {isChinese ? '返回登录' : 'Back to sign in'}
                    </Link>
                </div>
            </section>
        </main>
    );
}
