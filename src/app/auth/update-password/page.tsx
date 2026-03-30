'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { MotionButton } from '@/components/ui/motion-button';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

const MIN_PASSWORD_LENGTH = 6;

function resolveLocale() {
    if (typeof navigator === 'undefined') {
        return 'zh-CN';
    }

    return navigator.language?.startsWith('zh') ? 'zh-CN' : navigator.language || 'en-US';
}

export default function UpdatePasswordPage() {
    const router = useRouter();
    const supabase = getSupabaseClient();
    const configured = isSupabaseConfigured();
    const [locale, setLocale] = useState('zh-CN');
    const [recoveryTokenHash, setRecoveryTokenHash] = useState<string | null>(null);
    const [recoveryType, setRecoveryType] = useState<string | null>(null);
    const [paramsReady, setParamsReady] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [ready, setReady] = useState(false);
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
        setRecoveryTokenHash(params.get('token_hash'));
        setRecoveryType(params.get('type'));
        setParamsReady(true);
    }, []);

    useEffect(() => {
        const authClient = supabase;
        if (!authClient || !paramsReady) {
            return;
        }

        let active = true;

        async function prepareRecoverySession() {
            if (recoveryTokenHash && recoveryType === 'recovery') {
                const { error } = await authClient!.auth.verifyOtp({
                    token_hash: recoveryTokenHash,
                    type: 'recovery',
                });

                if (!active) {
                    return;
                }

                if (error) {
                    setErrorMessage(
                        isChinese ? '重置链接无效或已过期，请重新申请。' : 'Recovery link is invalid or expired.'
                    );
                    return;
                }

                setReady(true);
                return;
            }

            const {
                data: { session },
            } = await authClient!.auth.getSession();

            if (!active) {
                return;
            }

            if (session) {
                setReady(true);
            } else {
                setErrorMessage(
                    isChinese
                        ? '请使用邮箱中的重置链接进入此页面。'
                        : 'Please open this page from the reset email link.'
                );
            }
        }

        void prepareRecoverySession();

        return () => {
            active = false;
        };
    }, [isChinese, paramsReady, recoveryTokenHash, recoveryType, supabase]);

    async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!supabase) {
            setErrorMessage(isChinese ? 'Supabase 尚未配置。' : 'Supabase is not configured.');
            return;
        }

        if (!ready) {
            setErrorMessage(isChinese ? '当前重置会话不可用。' : 'Recovery session is not ready.');
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

        if (password !== confirmPassword) {
            setErrorMessage(isChinese ? '两次输入的密码不一致。' : 'Passwords do not match.');
            return;
        }

        setBusy(true);
        setErrorMessage(null);
        setInfoMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({
                password,
            });

            if (error) {
                throw error;
            }

            setInfoMessage(isChinese ? '密码更新成功，请重新登录。' : 'Password updated. Please sign in again.');
            await supabase.auth.signOut();
            window.setTimeout(() => {
                router.replace('/auth');
            }, 800);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : isChinese ? '密码更新失败。' : 'Failed to update password.');
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
                <h1 className="auth-card__title">{isChinese ? '设置新密码' : 'Set New Password'}</h1>
                <p className="auth-card__subtitle">
                    {isChinese ? '请输入新的登录密码。' : 'Enter your new account password.'}
                </p>

                <form className="auth-card__form" onSubmit={(event) => void handlePasswordUpdate(event)}>
                    <label className="auth-card__label">
                        {isChinese ? '新密码' : 'New password'}
                        <input
                            autoComplete="new-password"
                            className="auth-card__input"
                            minLength={MIN_PASSWORD_LENGTH}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                            type="password"
                            value={password}
                        />
                    </label>

                    <label className="auth-card__label">
                        {isChinese ? '确认新密码' : 'Confirm new password'}
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

                    {errorMessage ? <p className="auth-card__error">{errorMessage}</p> : null}
                    {infoMessage ? <p className="auth-card__success">{infoMessage}</p> : null}

                    <div className="auth-card__actions">
                        <MotionButton className="planner-button auth-card__submit" disabled={busy || !ready} type="submit">
                            {busy
                                ? isChinese
                                    ? '更新中...'
                                    : 'Updating...'
                                : isChinese
                                    ? '更新密码'
                                    : 'Update password'}
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
