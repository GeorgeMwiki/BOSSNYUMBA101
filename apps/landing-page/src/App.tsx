import React, { useState } from 'react';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'For You', href: '#for-you' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Contact', href: '#contact' },
];

const FEATURES = [
  { icon: '🏠', title: 'Smart Property Management', desc: 'End-to-end property lifecycle management with intelligent automation and real-time insights.' },
  { icon: '💳', title: 'Seamless Payments', desc: 'M-Pesa, bank transfers, and card payments. Automated invoicing, receipting, and reconciliation.' },
  { icon: '🔧', title: 'Maintenance Intelligence', desc: 'AI-prioritized work orders, vendor matching, SLA tracking, and tenant satisfaction scoring.' },
  { icon: '📊', title: 'Analytics & Reporting', desc: 'Occupancy trends, revenue forecasting, expense tracking, and customizable dashboards.' },
  { icon: '🔐', title: 'Role-Based Access', desc: 'Dynamic roles — be an owner AND tenant simultaneously. Progressive feature discovery adapts to your needs.' },
  { icon: '📱', title: 'Mobile-First Design', desc: 'Native mobile apps for technicians and tenants. Responsive web portals for owners and managers.' },
];

const PERSONAS = [
  {
    role: 'Property Owners',
    icon: '🏢',
    color: 'emerald',
    features: ['Portfolio overview dashboard', 'Revenue & expense analytics', 'Tenant management', 'Document storage & compliance', 'Multi-property support'],
  },
  {
    role: 'Tenants',
    icon: '🏡',
    color: 'blue',
    features: ['Pay rent via M-Pesa & cards', 'Submit maintenance requests', 'View lease details', 'Community notifications', 'Chat with management'],
  },
  {
    role: 'Estate Managers',
    icon: '📋',
    color: 'amber',
    features: ['Work order management', 'Inspection scheduling', 'Vendor coordination', 'Collections tracking', 'Occupancy management'],
  },
  {
    role: 'Technicians',
    icon: '🔧',
    color: 'rose',
    features: ['Mobile job queue', 'GPS-based routing', 'Photo documentation', 'Status updates in real-time', 'Performance tracking'],
  },
];

const PRICING = [
  {
    name: 'Starter',
    price: 'Free',
    period: 'for up to 10 units',
    features: ['Basic property management', 'Tenant portal', 'M-Pesa payments', 'Email support'],
    cta: 'Get Started',
    featured: false,
  },
  {
    name: 'Professional',
    price: 'KES 5,000',
    period: '/month per property',
    features: ['Everything in Starter', 'Advanced analytics', 'Maintenance automation', 'Vendor management', 'Priority support', 'Custom branding'],
    cta: 'Start Free Trial',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'for portfolios 100+ units',
    features: ['Everything in Professional', 'Dedicated account manager', 'Custom integrations', 'SLA guarantees', 'On-premise option', 'Training & onboarding'],
    cta: 'Contact Sales',
    featured: false,
  },
];

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-navy-900 font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="container-max section-padding !py-0">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <a href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <span className="text-white font-extrabold text-sm">BN</span>
              </div>
              <span className="text-xl font-bold tracking-tight">BOSSNYUMBA</span>
            </a>

            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map(l => (
                <a key={l.href} href={l.href} className="nav-link">{l.label}</a>
              ))}
              <a href="#pricing" className="btn-primary !px-6 !py-2.5 text-sm">Get Started</a>
            </div>

            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden pb-6 border-t border-gray-100 pt-4">
              {NAV_LINKS.map(l => (
                <a key={l.href} href={l.href} className="block py-3 text-navy-900/70 hover:text-navy-900" onClick={() => setMobileMenuOpen(false)}>{l.label}</a>
              ))}
              <a href="#pricing" className="btn-primary mt-4 w-full text-center">Get Started</a>
            </div>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-navy-900 via-navy-800 to-navy-900 text-white pt-32 sm:pt-40 pb-20 sm:pb-32">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        </div>
        <div className="container-max section-padding !py-0 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              East Africa's Leading PropTech Platform
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold leading-tight tracking-tight mb-6">
              Property Management,{' '}
              <span className="text-gradient-hero">Reimagined</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
              The all-in-one platform that connects property owners, tenants, managers, and technicians.
              Collect rent, manage maintenance, and grow your portfolio — all from one dashboard.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#pricing" className="btn-primary text-lg">
                Start Free Trial
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </a>
              <a href="#features" className="btn-secondary text-lg">See How It Works</a>
            </div>
            <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
              <div><p className="text-3xl font-extrabold text-gradient">500+</p><p className="text-sm text-white/50 mt-1">Properties</p></div>
              <div><p className="text-3xl font-extrabold text-gradient">10K+</p><p className="text-sm text-white/50 mt-1">Tenants</p></div>
              <div><p className="text-3xl font-extrabold text-gradient">99.9%</p><p className="text-sm text-white/50 mt-1">Uptime</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="section-padding bg-gray-50">
        <div className="container-max">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-emerald-600 font-semibold text-sm uppercase tracking-wider mb-3">Platform Features</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Everything you need to manage properties</h2>
            <p className="text-navy-900/60 text-lg">Built for the East African market with M-Pesa integration, multi-language support, and mobile-first design.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="feature-card">
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-navy-900/60 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For You */}
      <section id="for-you" className="section-padding">
        <div className="container-max">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-emerald-600 font-semibold text-sm uppercase tracking-wider mb-3">Built For Everyone</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">One platform, every stakeholder</h2>
            <p className="text-navy-900/60 text-lg">Whether you own, rent, manage, or maintain — BOSSNYUMBA works for you.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {PERSONAS.map((p, i) => (
              <div key={i} className="feature-card !p-0 overflow-hidden">
                <div className={`p-6 ${p.color === 'emerald' ? 'bg-emerald-50' : p.color === 'blue' ? 'bg-blue-50' : p.color === 'amber' ? 'bg-amber-50' : 'bg-rose-50'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{p.icon}</span>
                    <h3 className="text-xl font-bold">{p.role}</h3>
                  </div>
                </div>
                <div className="p-6">
                  <ul className="space-y-3">
                    {p.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-3 text-sm text-navy-900/70">
                        <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="section-padding bg-gray-50">
        <div className="container-max">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-emerald-600 font-semibold text-sm uppercase tracking-wider mb-3">Simple Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Start free, scale as you grow</h2>
            <p className="text-navy-900/60 text-lg">No hidden fees. Cancel anytime. All plans include core features.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {PRICING.map((p, i) => (
              <div key={i} className={p.featured ? 'pricing-card-featured' : 'pricing-card'}>
                {p.featured && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full uppercase tracking-wider">
                    Most Popular
                  </div>
                )}
                <h3 className={`text-xl font-bold mb-2 ${p.featured ? 'text-white' : ''}`}>{p.name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`text-4xl font-extrabold ${p.featured ? 'text-white' : ''}`}>{p.price}</span>
                </div>
                <p className={`text-sm mb-6 ${p.featured ? 'text-white/60' : 'text-navy-900/50'}`}>{p.period}</p>
                <ul className="space-y-3 mb-8">
                  {p.features.map((f, j) => (
                    <li key={j} className={`flex items-center gap-3 text-sm ${p.featured ? 'text-white/80' : 'text-navy-900/70'}`}>
                      <svg className={`w-4 h-4 flex-shrink-0 ${p.featured ? 'text-emerald-400' : 'text-emerald-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="#contact" className={`block text-center ${p.featured ? 'btn-amber' : 'btn-outline'} w-full`}>{p.cta}</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 right-20 w-64 h-64 bg-emerald-500/30 rounded-full blur-3xl" />
        </div>
        <div className="container-max relative z-10 text-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-6">Ready to transform your property management?</h2>
          <p className="text-lg text-white/70 max-w-xl mx-auto mb-10">Join hundreds of property owners and managers across East Africa who trust BOSSNYUMBA.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#pricing" className="btn-primary text-lg">Start Your Free Trial</a>
            <a href="#contact" className="btn-secondary text-lg">Book a Demo</a>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="section-padding">
        <div className="container-max">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-emerald-600 font-semibold text-sm uppercase tracking-wider mb-3">Get in Touch</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Let's talk about your properties</h2>
            <p className="text-navy-900/60 text-lg mb-8">Whether you have 1 unit or 1,000, we'd love to show you how BOSSNYUMBA can help.</p>
            <form className="space-y-4 text-left" onSubmit={e => e.preventDefault()}>
              <div className="grid sm:grid-cols-2 gap-4">
                <input type="text" placeholder="Full name" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" />
                <input type="email" placeholder="Email address" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" />
              </div>
              <input type="tel" placeholder="Phone number (+255...)" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" />
              <textarea rows={4} placeholder="Tell us about your properties..." className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition resize-none" />
              <button type="submit" className="btn-primary w-full text-lg">Send Message</button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-900 text-white section-padding !py-12">
        <div className="container-max">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <span className="text-white font-extrabold text-sm">BN</span>
                </div>
                <span className="text-xl font-bold">BOSSNYUMBA</span>
              </div>
              <p className="text-white/50 text-sm leading-relaxed">East Africa's leading property management platform. Built for the way you work.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-white/50">
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition">Mobile Apps</a></li>
                <li><a href="#" className="hover:text-white transition">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-white/50">
                <li><a href="#" className="hover:text-white transition">About</a></li>
                <li><a href="#" className="hover:text-white transition">Careers</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                <li><a href="#contact" className="hover:text-white transition">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-white/50">
                <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition">Data Processing</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-white/40">&copy; {new Date().getFullYear()} BOSSNYUMBA. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="#" className="text-white/40 hover:text-white transition" aria-label="Twitter">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
              </a>
              <a href="#" className="text-white/40 hover:text-white transition" aria-label="LinkedIn">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
