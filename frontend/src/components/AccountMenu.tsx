import { useState, useRef, useEffect } from 'react';
import { User, LogOut, Settings, ChevronDown, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

interface AccountMenuProps {
    onNavigate: (page: 'profile' | 'settings' | 'admin') => void;
}

export function AccountMenu({ onNavigate }: AccountMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const { user, logout } = useAuth();
    const menuRef = useRef<HTMLDivElement>(null);

    // Check admin status
    useEffect(() => {
        const checkAdmin = async () => {
            try {
                const res = await axios.get('/api/admin/check');
                setIsAdmin(res.data.isAdmin);
            } catch (error) {
                setIsAdmin(false);
            }
        };
        if (user) checkAdmin();
    }, [user]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleLogout = async () => {
        try {
            await axios.post('/api/auth/logout');
            logout();
        } catch (error) {
            console.error('Logout failed', error);
            logout(); // Logout anyway on client side
        }
    };

    if (!user) return null;

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg bg-white hover:bg-[#e8f6f9] border border-slate-200 hover:border-[#bfe0e6] transition-colors"
            >
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-white font-medium text-[12px]" style={{ backgroundColor: '#0e5a6e' }}>
                    {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block text-left leading-tight">
                    <div className="text-[12px] font-medium text-slate-700">{user.name || 'User'}</div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-pop border border-stone-200 overflow-hidden animate-fade-in origin-top-right">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-stone-100">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-medium text-sm" style={{ backgroundColor: '#0e5a6e' }}>
                                {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-semibold text-stone-800 truncate">{user.name || 'User'}</div>
                                <div className="text-[12px] text-stone-500 truncate">{user.email}</div>
                            </div>
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1.5">
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                onNavigate('profile');
                            }}
                            className="w-full px-4 py-2 flex items-center gap-3 text-stone-700 hover:bg-stone-50 transition-colors text-left"
                        >
                            <User className="w-4 h-4 text-stone-400" />
                            <span className="text-[13px] font-medium">Profile</span>
                        </button>
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                onNavigate('settings');
                            }}
                            className="w-full px-4 py-2 flex items-center gap-3 text-stone-700 hover:bg-stone-50 transition-colors text-left"
                        >
                            <Settings className="w-4 h-4 text-stone-400" />
                            <span className="text-[13px] font-medium">Settings</span>
                        </button>
                        {isAdmin && (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onNavigate('admin');
                                }}
                                className="w-full px-4 py-2 flex items-center gap-3 text-stone-800 hover:bg-stone-50 transition-colors text-left"
                            >
                                <Shield className="w-4 h-4 text-stone-500" />
                                <span className="text-[13px] font-medium">Admin Dashboard</span>
                            </button>
                        )}
                    </div>

                    {/* Logout */}
                    <div className="border-t border-stone-100 py-1.5">
                        <button
                            onClick={handleLogout}
                            className="w-full px-4 py-2 flex items-center gap-3 text-rose-600 hover:bg-rose-50 transition-colors text-left"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="text-[13px] font-medium">Logout</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
