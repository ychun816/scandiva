import { ArrowLeft, FileText, AlertCircle, Ban, Scale } from 'lucide-react';

interface TermsOfServiceProps {
    onBack: () => void;
}

export function TermsOfService({ onBack }: TermsOfServiceProps) {
    return (
        <div className="h-full overflow-y-auto board-surface">
            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-6 flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-lg bg-white/80 hover:bg-white border border-slate-200/70 hover:border-[#9fcdd6] transition-all"
                    >
                        <ArrowLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-semibold text-[#0e4a58] flex items-center gap-2">
                            <FileText className="w-[18px] h-[18px] text-[#0e5a6e]" />
                            Terms of Service
                        </h1>
                        <p className="text-slate-500 text-[12.5px]">Last updated: December 4, 2025</p>
                    </div>
                </div>

                {/* Content */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/70 p-7 shadow-card space-y-8">
                    {/* Acceptance */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">1. Acceptance of Terms</h2>
                        <p className="text-slate-700 leading-relaxed">
                            By accessing and using Candivana ("the Service"), you accept and agree to be bound by the terms and provisions of this agreement.
                            If you do not agree to these terms, please do not use the Service.
                        </p>
                    </section>

                    {/* Description */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">2. Description of Service</h2>
                        <p className="text-slate-700 leading-relaxed mb-3">
                            Candivana is a self-hosted job application tracking tool that helps you organize and manage your job search process.
                            The Service allows you to:
                        </p>
                        <ul className="space-y-2 text-slate-700">
                            <li className="flex items-start gap-2">
                                <span className="text-[#0e5a6e] mt-1">•</span>
                                <span>Track job applications across different stages</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#0e5a6e] mt-1">•</span>
                                <span>Store application-related documents</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#0e5a6e] mt-1">•</span>
                                <span>View analytics and statistics</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#0e5a6e] mt-1">•</span>
                                <span>Manage your job search timeline</span>
                            </li>
                        </ul>
                    </section>

                    {/* User Accounts */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">3. User Accounts</h2>
                        <div className="space-y-3 text-slate-700">
                            <p>When you create an account with us, you must provide accurate, complete, and current information.</p>
                            <p>You are responsible for:</p>
                            <ul className="space-y-2 ml-4">
                                <li className="flex items-start gap-2">
                                    <span className="text-[#0e5a6e] mt-1">•</span>
                                    <span>Safeguarding your password</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-[#0e5a6e] mt-1">•</span>
                                    <span>All activities that occur under your account</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-[#0e5a6e] mt-1">•</span>
                                    <span>Notifying us immediately of any unauthorized use</span>
                                </li>
                            </ul>
                        </div>
                    </section>

                    {/* Acceptable Use */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <AlertCircle className="w-6 h-6 text-[#0e5a6e]" />
                            4. Acceptable Use
                        </h2>
                        <p className="text-slate-700 mb-3">You agree not to use the Service to:</p>
                        <div className="space-y-2 text-slate-700">
                            <div className="p-3 bg-red-50 rounded-lg border border-red-100 flex items-start gap-2">
                                <Ban className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <span>Violate any applicable laws or regulations</span>
                            </div>
                            <div className="p-3 bg-red-50 rounded-lg border border-red-100 flex items-start gap-2">
                                <Ban className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <span>Infringe upon the rights of others</span>
                            </div>
                            <div className="p-3 bg-red-50 rounded-lg border border-red-100 flex items-start gap-2">
                                <Ban className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <span>Transmit any harmful code or malware</span>
                            </div>
                            <div className="p-3 bg-red-50 rounded-lg border border-red-100 flex items-start gap-2">
                                <Ban className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <span>Attempt to gain unauthorized access to the Service</span>
                            </div>
                        </div>
                    </section>

                    {/* Intellectual Property */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">5. Intellectual Property</h2>
                        <p className="text-slate-700 leading-relaxed mb-3">
                            The Service and its original content, features, and functionality are owned by Candivana and are protected by international copyright,
                            trademark, patent, trade secret, and other intellectual property laws.
                        </p>
                        <p className="text-slate-700 leading-relaxed">
                            Your data and content remain yours. We claim no intellectual property rights over the material you provide to the Service.
                        </p>
                    </section>

                    {/* Termination */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">6. Termination</h2>
                        <p className="text-slate-700 leading-relaxed mb-3">
                            We may terminate or suspend your account immediately, without prior notice or liability, for any reason, including if you breach the Terms.
                        </p>
                        <p className="text-slate-700 leading-relaxed">
                            Upon termination, your right to use the Service will immediately cease. You may delete your account at any time through the Settings page.
                        </p>
                    </section>

                    {/* Limitation of Liability */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">7. Limitation of Liability</h2>
                        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                            <p className="text-slate-700 leading-relaxed">
                                The Service is provided "as is" and "as available" without any warranties of any kind. We do not guarantee that the Service will be
                                uninterrupted, timely, secure, or error-free. In no event shall Candivana be liable for any indirect, incidental, special, consequential,
                                or punitive damages.
                            </p>
                        </div>
                    </section>

                    {/* Changes to Terms */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">8. Changes to Terms</h2>
                        <p className="text-slate-700 leading-relaxed">
                            We reserve the right to modify or replace these Terms at any time. We will provide notice of any material changes by posting the new Terms
                            on this page and updating the "Last updated" date. Your continued use of the Service after any changes constitutes acceptance of the new Terms.
                        </p>
                    </section>

                    {/* Governing Law */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Scale className="w-6 h-6 text-[#0e5a6e]" />
                            9. Governing Law
                        </h2>
                        <p className="text-slate-700 leading-relaxed">
                            These Terms shall be governed and construed in accordance with the laws of the European Union and applicable local laws,
                            without regard to its conflict of law provisions.
                        </p>
                    </section>

                    {/* Contact */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">10. Contact Information</h2>
                        <p className="text-slate-700 leading-relaxed mb-4">
                            If you have any questions about these Terms, please contact us:
                        </p>
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-slate-700 font-medium">Email: legal@candivana.example.com</p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
