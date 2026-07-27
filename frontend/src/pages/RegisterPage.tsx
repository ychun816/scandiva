import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard } from 'lucide-react';

interface RegisterPageProps {
    onSwitchToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
                credentials: 'include',
            });

            if (response.ok) {
                const user = await response.json();
                login(user);
            } else {
                const data = await response.json();
                setError(data.error || 'Registration failed');
            }
        } catch (err) {
            setError('Network error');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center font-sans text-stone-900 px-4" style={{ background: 'var(--bg)' }}>
            <div className="bg-white border border-stone-200 p-8 rounded-2xl shadow-card w-full max-w-sm">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-stone-900 w-11 h-11 rounded-xl flex items-center justify-center mb-4">
                        <LayoutDashboard className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-[22px] font-semibold text-stone-900 tracking-tight">Create account</h1>
                    <p className="text-[13px] text-stone-500 mt-1">Join Candivana today</p>
                </div>

                {error && (
                    <div className="bg-rose-50 text-rose-600 p-3 rounded-lg mb-4 text-[13px] font-medium border border-rose-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[13px] font-medium text-stone-600 mb-1.5">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-all text-[14px] placeholder:text-stone-400"
                            placeholder="Your name"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-[13px] font-medium text-stone-600 mb-1.5">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-all text-[14px] placeholder:text-stone-400"
                            placeholder="you@example.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-[13px] font-medium text-stone-600 mb-1.5">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-all text-[14px] placeholder:text-stone-400"
                            placeholder="At least 8 characters"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-stone-900 hover:bg-stone-800 text-white py-2.5 rounded-lg font-medium text-[14px] active:scale-[0.99] transition-all"
                    >
                        Sign up
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-[13px] text-stone-500">
                        Already have an account?{' '}
                        <button
                            onClick={onSwitchToLogin}
                            className="text-stone-900 font-medium hover:underline underline-offset-2 transition-colors"
                        >
                            Sign in
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};
