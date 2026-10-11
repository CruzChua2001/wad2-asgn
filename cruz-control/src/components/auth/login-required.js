"use client"

import { useAuth } from "./auth-provider"

const LoginRequired = ({ title, message }) => {
    const { openAuth } = useAuth();

    return (
        <div className="grid gap-3 p-6 border border-line rounded-xl bg-surface">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="text-muted">{message}</p>
            <button type="button" className="auth-primaryButton w-fit" onClick={() => openAuth("login")}>Log in</button>
        </div>
    )
}

export default LoginRequired;