import { useState, useEffect } from 'react';
import { X, Cookie, Shield } from 'lucide-react';

interface CookieBannerProps {
    onNavigateToPrivacy: () => void;
}

export function CookieBanner({ onNavigateToPrivacy }: CookieBannerProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Check if user has already made a choice
        const consent = localStorage.getItem('cookieConsent');
        if (!consent) {
            setIsVisible(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('cookieConsent', 'accepted');
        localStorage.setItem('cookieConsentDate', new Date().toISOString());
        setIsVisible(false);
    };

    const handleDecline = () => {
        localStorage.setItem('cookieConsent', 'declined');
        localStorage.setItem('cookieConsentDate', new Date().toISOString());
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-500">
            <div className="max-w-6xl mx-auto bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 p-6">
                <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-300/50">
                        <Cookie className="w-6 h-6 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-indigo-600" />
                            We Value Your Privacy
                        </h3>
                        <p className="text-sm text-slate-600 mb-4">
                            We use cookies to enhance your experience, analyze site usage, and remember your preferences.
                            By clicking "Accept", you consent to our use of cookies. You can manage your preferences anytime in settings.
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={handleAccept}
                                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-300/50 hover:shadow-xl text-sm"
                            >
                                Accept All
                            </button>
                            <button
                                onClick={handleDecline}
                                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors text-sm"
                            >
                                Decline Optional
                            </button>
                            <button
                                onClick={onNavigateToPrivacy}
                                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium underline"
                            >
                                Privacy Policy
                            </button>
                        </div>
                    </div>

                    {/* Close button */}
                    <button
                        onClick={handleDecline}
                        className="flex-shrink-0 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
