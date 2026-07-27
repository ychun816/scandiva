import { Shield, FileText } from 'lucide-react';

interface FooterProps {
    onNavigateToPrivacy: () => void;
    onNavigateToTerms: () => void;
}

export function Footer({ onNavigateToPrivacy, onNavigateToTerms }: FooterProps) {
    return (
        <footer className="bg-white/50 backdrop-blur-sm border-t border-slate-200/60 py-6 mt-auto">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    {/* Copyright */}
                    <div className="text-sm text-slate-600">
                        © {new Date().getFullYear()} Candivana. All rights reserved.
                    </div>

                    {/* Links */}
                    <div className="flex items-center gap-6">
                        <button
                            onClick={onNavigateToPrivacy}
                            className="text-sm text-slate-600 hover:text-indigo-600 transition-colors flex items-center gap-1.5 font-medium"
                        >
                            <Shield className="w-4 h-4" />
                            Privacy Policy
                        </button>
                        <button
                            onClick={onNavigateToTerms}
                            className="text-sm text-slate-600 hover:text-indigo-600 transition-colors flex items-center gap-1.5 font-medium"
                        >
                            <FileText className="w-4 h-4" />
                            Terms of Service
                        </button>
                    </div>
                </div>
            </div>
        </footer>
    );
}
