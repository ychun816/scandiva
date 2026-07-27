import { ArrowLeft, Shield, Mail, Calendar, Database, Lock, Eye } from 'lucide-react';

interface PrivacyPolicyProps {
    onBack: () => void;
}

export function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
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
                            <Shield className="w-[18px] h-[18px] text-[#0e5a6e]" />
                            Privacy Policy
                        </h1>
                        <p className="text-slate-500 text-[12.5px]">Last updated: December 4, 2025</p>
                    </div>
                </div>

                {/* Content */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/70 p-7 shadow-card space-y-8">
                    {/* Introduction */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">Introduction</h2>
                        <p className="text-slate-700 leading-relaxed">
                            Welcome to Candivana. We respect your privacy and are committed to protecting your personal data.
                            This privacy policy explains how we collect, use, and safeguard your information when you use our job application tracking service.
                        </p>
                    </section>

                    {/* Data We Collect */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Database className="w-6 h-6 text-[#0e5a6e]" />
                            Data We Collect
                        </h2>
                        <div className="space-y-4 text-slate-700">
                            <div>
                                <h3 className="font-semibold text-slate-800 mb-2">Account Information</h3>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li>Email address (for authentication)</li>
                                    <li>Name (optional, for personalization)</li>
                                    <li>Password (encrypted and hashed)</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800 mb-2">Application Data</h3>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li>Company names and job positions</li>
                                    <li>Application dates and statuses</li>
                                    <li>Notes and custom fields you create</li>
                                    <li>Uploaded documents (CV, cover letters)</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800 mb-2">Usage Data</h3>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li>Login timestamps</li>
                                    <li>Feature usage patterns</li>
                                    <li>Browser type and version</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* How We Use Your Data */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Eye className="w-6 h-6 text-[#0e5a6e]" />
                            How We Use Your Data
                        </h2>
                        <ul className="space-y-2 text-slate-700">
                            <li className="flex items-start gap-2">
                                <span className="text-[#0e5a6e] mt-1">•</span>
                                <span>To provide and maintain our service</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#0e5a6e] mt-1">•</span>
                                <span>To notify you about changes to our service</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#0e5a6e] mt-1">•</span>
                                <span>To provide customer support</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#0e5a6e] mt-1">•</span>
                                <span>To analyze usage and improve our service</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#0e5a6e] mt-1">•</span>
                                <span>To detect and prevent technical issues</span>
                            </li>
                        </ul>
                    </section>

                    {/* Data Security */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Lock className="w-6 h-6 text-[#0e5a6e]" />
                            Data Security
                        </h2>
                        <p className="text-slate-700 leading-relaxed">
                            We implement appropriate technical and organizational security measures to protect your personal data against
                            unauthorized access, alteration, disclosure, or destruction. This includes:
                        </p>
                        <ul className="mt-3 space-y-2 text-slate-700">
                            <li className="flex items-start gap-2">
                                <span className="text-[#0e5a6e] mt-1">•</span>
                                <span>Encrypted password storage using bcrypt</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#0e5a6e] mt-1">•</span>
                                <span>Secure HTTPS connections</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#0e5a6e] mt-1">•</span>
                                <span>Regular security updates and patches</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#0e5a6e] mt-1">•</span>
                                <span>Access controls and authentication</span>
                            </li>
                        </ul>
                    </section>

                    {/* Your Rights (GDPR) */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">Your Rights Under GDPR</h2>
                        <p className="text-slate-700 mb-4">
                            If you are in the European Economic Area (EEA), you have the following data protection rights:
                        </p>
                        <div className="space-y-3 text-slate-700">
                            <div className="p-4 bg-[#e8f6f9] rounded-lg border border-[#bfe0e6]">
                                <h3 className="font-semibold text-[#0e4a58] mb-1">Right to Access</h3>
                                <p className="text-sm">You can request a copy of your personal data at any time via the Settings page.</p>
                            </div>
                            <div className="p-4 bg-[#eef4f5] rounded-lg border border-[#cfe7eb]">
                                <h3 className="font-semibold text-[#0e4a58] mb-1">Right to Rectification</h3>
                                <p className="text-sm">You can update your personal information in your Profile settings.</p>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                                <h3 className="font-semibold text-blue-900 mb-1">Right to Erasure</h3>
                                <p className="text-sm">You can delete your account and all associated data via Settings → Delete Account.</p>
                            </div>
                            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                                <h3 className="font-semibold text-green-900 mb-1">Right to Data Portability</h3>
                                <p className="text-sm">You can export all your data in JSON format via Settings → Export Data.</p>
                            </div>
                        </div>
                    </section>

                    {/* Cookies */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">Cookies</h2>
                        <p className="text-slate-700 leading-relaxed mb-3">
                            We use cookies and similar tracking technologies to track activity on our service. Cookies are files with a small amount of data.
                        </p>
                        <div className="space-y-2 text-slate-700">
                            <div>
                                <span className="font-semibold">Essential Cookies:</span> Required for authentication and basic functionality
                            </div>
                            <div>
                                <span className="font-semibold">Preference Cookies:</span> Remember your settings and preferences
                            </div>
                        </div>
                    </section>

                    {/* Contact */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Mail className="w-6 h-6 text-[#0e5a6e]" />
                            Contact Us
                        </h2>
                        <p className="text-slate-700 leading-relaxed">
                            If you have any questions about this Privacy Policy or wish to exercise your data protection rights, please contact us at:
                        </p>
                        <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-slate-700 font-medium">Email: privacy@candivana.example.com</p>
                        </div>
                    </section>

                    {/* Changes to Policy */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Calendar className="w-6 h-6 text-[#0e5a6e]" />
                            Changes to This Policy
                        </h2>
                        <p className="text-slate-700 leading-relaxed">
                            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page
                            and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
