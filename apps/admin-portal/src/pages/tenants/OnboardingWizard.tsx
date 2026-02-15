import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  FileText,
  CreditCard,
  UserPlus,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  X,
  AlertTriangle,
  Shield,
  Sparkles,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────

interface OrganizationDetails {
  name: string;
  industry: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  website: string;
  registrationNumber: string;
}

interface PolicyConstitution {
  lateFeeType: 'percentage' | 'fixed';
  lateFeeValue: number;
  gracePeriodDays: number;
  autoReminders: boolean;
  reminderDaysBeforeDue: number;
  autoLateFee: boolean;
  maxPaymentRetries: number;
  leaseAutoRenewal: boolean;
  securityDepositMonths: number;
  noticeperiodDays: number;
}

interface SubscriptionPlan {
  plan: 'starter' | 'professional' | 'enterprise';
  billingCycle: 'monthly' | 'annual';
  startTrial: boolean;
}

interface AdminUser {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  sendInvite: boolean;
}

// ─── Steps Config ──────────────────────────────────────────

const steps = [
  { id: 'organization', label: 'Organization', icon: Building2, description: 'Basic company details' },
  { id: 'policy', label: 'Policy Constitution', icon: FileText, description: 'Define operating rules' },
  { id: 'subscription', label: 'Subscription Plan', icon: CreditCard, description: 'Choose a plan' },
  { id: 'admin', label: 'Admin User', icon: UserPlus, description: 'Create admin account' },
  { id: 'review', label: 'Review & Activate', icon: CheckCircle, description: 'Confirm and go live' },
];

const plans = [
  {
    id: 'starter' as const,
    name: 'Starter',
    monthlyPrice: 15000,
    annualPrice: 150000,
    features: ['Up to 10 properties', 'Up to 50 units', '3 users', 'Basic reporting', 'Email support'],
  },
  {
    id: 'professional' as const,
    name: 'Professional',
    monthlyPrice: 45000,
    annualPrice: 450000,
    features: ['Up to 50 properties', 'Up to 500 units', '15 users', 'Advanced reporting', 'Priority support', 'API access', 'Custom branding'],
    popular: true,
  },
  {
    id: 'enterprise' as const,
    name: 'Enterprise',
    monthlyPrice: 125000,
    annualPrice: 1250000,
    features: ['Unlimited properties', 'Unlimited units', 'Unlimited users', 'AI-powered insights', '24/7 dedicated support', 'Custom integrations', 'SLA guarantee', 'Dedicated account manager'],
  },
];

// ─── Component ─────────────────────────────────────────────

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [orgDetails, setOrgDetails] = useState<OrganizationDetails>({
    name: '', industry: 'real_estate', address: '', city: '', country: 'Kenya', phone: '', website: '', registrationNumber: '',
  });

  const [policy, setPolicy] = useState<PolicyConstitution>({
    lateFeeType: 'percentage', lateFeeValue: 5, gracePeriodDays: 5, autoReminders: true, reminderDaysBeforeDue: 3,
    autoLateFee: true, maxPaymentRetries: 3, leaseAutoRenewal: false, securityDepositMonths: 2, noticeperiodDays: 30,
  });

  const [subscription, setSubscription] = useState<SubscriptionPlan>({
    plan: 'professional', billingCycle: 'monthly', startTrial: true,
  });

  const [admin, setAdmin] = useState<AdminUser>({
    firstName: '', lastName: '', email: '', phone: '', role: 'TENANT_ADMIN', sendInvite: true,
  });

  // ─── Validation ────────────────────────────────────────────

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0: return !!(orgDetails.name && orgDetails.address && orgDetails.city && orgDetails.phone);
      case 1: return policy.gracePeriodDays >= 0 && policy.lateFeeValue >= 0;
      case 2: return !!subscription.plan;
      case 3: return !!(admin.firstName && admin.lastName && admin.email);
      case 4: return true;
      default: return false;
    }
  };

  const goNext = () => { if (validateStep(currentStep) && currentStep < steps.length - 1) setCurrentStep(currentStep + 1); };
  const goBack = () => { if (currentStep > 0) setCurrentStep(currentStep - 1); };

  const handleSubmit = async () => {
    setSubmitting(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 2000));
    setSubmitting(false);
    setSubmitted(true);
  };

  const selectedPlan = plans.find((p) => p.id === subscription.plan)!;
  const price = subscription.billingCycle === 'monthly' ? selectedPlan.monthlyPrice : selectedPlan.annualPrice;

  // ─── Success screen ────────────────────────────────────────

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Tenant Created Successfully!</h1>
        <p className="text-gray-500 mb-2">{orgDetails.name} has been onboarded and is ready to go.</p>
        <p className="text-sm text-gray-400 mb-8">
          An invitation email has been sent to <span className="font-medium text-gray-600">{admin.email}</span>
        </p>
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-left mb-8">
          <h3 className="font-semibold text-gray-900 mb-4">Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Organization:</span><p className="font-medium">{orgDetails.name}</p></div>
            <div><span className="text-gray-500">Plan:</span><p className="font-medium">{selectedPlan.name} ({subscription.billingCycle})</p></div>
            <div><span className="text-gray-500">Admin:</span><p className="font-medium">{admin.firstName} {admin.lastName}</p></div>
            <div><span className="text-gray-500">Trial:</span><p className="font-medium">{subscription.startTrial ? '14-day free trial' : 'No trial'}</p></div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => navigate('/tenants')} className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
            Back to Tenants
          </button>
          <button onClick={() => { setSubmitted(false); setCurrentStep(0); setOrgDetails({ name: '', industry: 'real_estate', address: '', city: '', country: 'Kenya', phone: '', website: '', registrationNumber: '' }); setAdmin({ firstName: '', lastName: '', email: '', phone: '', role: 'TENANT_ADMIN', sendInvite: true }); }} className="px-6 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium">
            Onboard Another
          </button>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Onboard New Tenant</h1>
          <p className="text-sm text-gray-500 mt-1">Set up a new tenant organization step by step</p>
        </div>
        <button onClick={() => navigate('/tenants')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isComplete = index < currentStep;
            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => { if (index < currentStep) setCurrentStep(index); }}
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                      isComplete ? 'bg-violet-600 border-violet-600 text-white' :
                      isActive ? 'bg-white border-violet-600 text-violet-600' :
                      'bg-white border-gray-200 text-gray-400'
                    } ${index < currentStep ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {isComplete ? <CheckCircle className="h-6 w-6" /> : <Icon className="h-5 w-5" />}
                  </button>
                  <span className={`mt-2 text-xs font-medium ${isActive ? 'text-violet-600' : isComplete ? 'text-gray-900' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 mt-[-20px] ${index < currentStep ? 'bg-violet-600' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
        {/* Step 0: Organization Details */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Organization Details</h2>
              <p className="text-sm text-gray-500">Enter the basic information about the tenant organization</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name *</label>
                <input type="text" value={orgDetails.name} onChange={(e) => setOrgDetails({ ...orgDetails, name: e.target.value })} placeholder="e.g., Acme Properties Ltd" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                <select value={orgDetails.industry} onChange={(e) => setOrgDetails({ ...orgDetails, industry: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500">
                  <option value="real_estate">Real Estate Management</option>
                  <option value="property_development">Property Development</option>
                  <option value="hospitality">Hospitality</option>
                  <option value="commercial">Commercial Property</option>
                  <option value="residential">Residential Only</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                <input type="text" value={orgDetails.registrationNumber} onChange={(e) => setOrgDetails({ ...orgDetails, registrationNumber: e.target.value })} placeholder="Company registration number" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                <input type="text" value={orgDetails.address} onChange={(e) => setOrgDetails({ ...orgDetails, address: e.target.value })} placeholder="Street address" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <input type="text" value={orgDetails.city} onChange={(e) => setOrgDetails({ ...orgDetails, city: e.target.value })} placeholder="e.g., Nairobi" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <select value={orgDetails.country} onChange={(e) => setOrgDetails({ ...orgDetails, country: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500">
                  <option value="Kenya">Kenya</option>
                  <option value="Tanzania">Tanzania</option>
                  <option value="Uganda">Uganda</option>
                  <option value="Rwanda">Rwanda</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input type="tel" value={orgDetails.phone} onChange={(e) => setOrgDetails({ ...orgDetails, phone: e.target.value })} placeholder="+254 7XX XXX XXX" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input type="url" value={orgDetails.website} onChange={(e) => setOrgDetails({ ...orgDetails, website: e.target.value })} placeholder="https://www.company.co.ke" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Policy Constitution */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Policy Constitution</h2>
              <p className="text-sm text-gray-500">Define the operating rules and policies for this tenant</p>
            </div>

            {/* Payment Policies */}
            <div className="border border-gray-200 rounded-lg p-5">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-violet-600" />
                Payment Policies
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Late Fee Type</label>
                  <select value={policy.lateFeeType} onChange={(e) => setPolicy({ ...policy, lateFeeType: e.target.value as 'percentage' | 'fixed' })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500">
                    <option value="percentage">Percentage of rent</option>
                    <option value="fixed">Fixed amount (KES)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Late Fee Value ({policy.lateFeeType === 'percentage' ? '%' : 'KES'})</label>
                  <input type="number" value={policy.lateFeeValue} onChange={(e) => setPolicy({ ...policy, lateFeeValue: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grace Period (days)</label>
                  <input type="number" value={policy.gracePeriodDays} onChange={(e) => setPolicy({ ...policy, gracePeriodDays: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Payment Retries</label>
                  <input type="number" value={policy.maxPaymentRetries} onChange={(e) => setPolicy({ ...policy, maxPaymentRetries: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={policy.autoLateFee} onChange={(e) => setPolicy({ ...policy, autoLateFee: e.target.checked })} className="h-4 w-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500" />
                  <label className="text-sm text-gray-700">Auto-apply late fees</label>
                </div>
              </div>
            </div>

            {/* Communication Policies */}
            <div className="border border-gray-200 rounded-lg p-5">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-600" />
                Communication & Reminders
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={policy.autoReminders} onChange={(e) => setPolicy({ ...policy, autoReminders: e.target.checked })} className="h-4 w-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500" />
                  <label className="text-sm text-gray-700">Enable automatic payment reminders</label>
                </div>
                {policy.autoReminders && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Days before due date</label>
                    <input type="number" value={policy.reminderDaysBeforeDue} onChange={(e) => setPolicy({ ...policy, reminderDaysBeforeDue: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
                  </div>
                )}
              </div>
            </div>

            {/* Lease Policies */}
            <div className="border border-gray-200 rounded-lg p-5">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-violet-600" />
                Lease Policies
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Security Deposit (months)</label>
                  <input type="number" value={policy.securityDepositMonths} onChange={(e) => setPolicy({ ...policy, securityDepositMonths: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notice Period (days)</label>
                  <input type="number" value={policy.noticeperiodDays} onChange={(e) => setPolicy({ ...policy, noticeperiodDays: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={policy.leaseAutoRenewal} onChange={(e) => setPolicy({ ...policy, leaseAutoRenewal: e.target.checked })} className="h-4 w-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500" />
                  <label className="text-sm text-gray-700">Enable automatic lease renewal</label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Subscription Plan */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Choose Subscription Plan</h2>
              <p className="text-sm text-gray-500">Select the right plan for this organization</p>
            </div>

            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-4">
              <span className={`text-sm font-medium ${subscription.billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-400'}`}>Monthly</span>
              <button onClick={() => setSubscription({ ...subscription, billingCycle: subscription.billingCycle === 'monthly' ? 'annual' : 'monthly' })} className="relative w-12 h-6 bg-violet-600 rounded-full transition-colors">
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${subscription.billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
              <span className={`text-sm font-medium ${subscription.billingCycle === 'annual' ? 'text-gray-900' : 'text-gray-400'}`}>Annual <span className="text-green-600">(Save 17%)</span></span>
            </div>

            {/* Plan Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSubscription({ ...subscription, plan: plan.id })}
                  className={`relative text-left p-6 rounded-xl border-2 transition-all ${
                    subscription.plan === plan.id ? 'border-violet-600 bg-violet-50 ring-1 ring-violet-600' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-violet-600 text-white text-xs font-medium rounded-full">Most Popular</span>}
                  <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  <div className="mt-2 mb-4">
                    <span className="text-3xl font-bold text-gray-900">KES {(subscription.billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice).toLocaleString()}</span>
                    <span className="text-sm text-gray-500">/{subscription.billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            {/* Trial option */}
            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <input type="checkbox" checked={subscription.startTrial} onChange={(e) => setSubscription({ ...subscription, startTrial: e.target.checked })} className="h-4 w-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500" />
              <div>
                <label className="text-sm font-medium text-blue-900">Start with 14-day free trial</label>
                <p className="text-xs text-blue-700">No charges until the trial period ends</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Admin User */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Create Admin User</h2>
              <p className="text-sm text-gray-500">Set up the primary administrator for {orgDetails.name || 'this organization'}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input type="text" value={admin.firstName} onChange={(e) => setAdmin({ ...admin, firstName: e.target.value })} placeholder="First name" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input type="text" value={admin.lastName} onChange={(e) => setAdmin({ ...admin, lastName: e.target.value })} placeholder="Last name" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} placeholder="admin@company.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={admin.phone} onChange={(e) => setAdmin({ ...admin, phone: e.target.value })} placeholder="+254 7XX XXX XXX" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={admin.role} onChange={(e) => setAdmin({ ...admin, role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500">
                  <option value="TENANT_ADMIN">Tenant Admin</option>
                  <option value="PROPERTY_MANAGER">Property Manager</option>
                </select>
              </div>
              <div className="flex items-center gap-3 self-end pb-2">
                <input type="checkbox" checked={admin.sendInvite} onChange={(e) => setAdmin({ ...admin, sendInvite: e.target.checked })} className="h-4 w-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500" />
                <label className="text-sm text-gray-700">Send email invitation</label>
              </div>
            </div>

            {admin.sendInvite && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">An invitation email with login credentials will be sent to <span className="font-medium">{admin.email || 'the admin email'}</span> upon activation.</p>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Review & Activate */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Review & Activate</h2>
              <p className="text-sm text-gray-500">Please review all details before activating this tenant</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Organization Summary */}
              <div className="border border-gray-200 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="h-5 w-5 text-violet-600" />
                  <h3 className="font-semibold text-gray-900">Organization</h3>
                  <button onClick={() => setCurrentStep(0)} className="ml-auto text-xs text-violet-600 hover:text-violet-700">Edit</button>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Name:</span><span className="font-medium text-gray-900">{orgDetails.name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">City:</span><span className="font-medium text-gray-900">{orgDetails.city}, {orgDetails.country}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Phone:</span><span className="font-medium text-gray-900">{orgDetails.phone}</span></div>
                  {orgDetails.registrationNumber && <div className="flex justify-between"><span className="text-gray-500">Reg #:</span><span className="font-medium text-gray-900">{orgDetails.registrationNumber}</span></div>}
                </div>
              </div>

              {/* Policy Summary */}
              <div className="border border-gray-200 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="h-5 w-5 text-violet-600" />
                  <h3 className="font-semibold text-gray-900">Policies</h3>
                  <button onClick={() => setCurrentStep(1)} className="ml-auto text-xs text-violet-600 hover:text-violet-700">Edit</button>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Late Fee:</span><span className="font-medium text-gray-900">{policy.lateFeeValue}{policy.lateFeeType === 'percentage' ? '%' : ' KES'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Grace Period:</span><span className="font-medium text-gray-900">{policy.gracePeriodDays} days</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Security Deposit:</span><span className="font-medium text-gray-900">{policy.securityDepositMonths} months</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Auto Reminders:</span><span className="font-medium text-gray-900">{policy.autoReminders ? 'Yes' : 'No'}</span></div>
                </div>
              </div>

              {/* Plan Summary */}
              <div className="border border-gray-200 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="h-5 w-5 text-violet-600" />
                  <h3 className="font-semibold text-gray-900">Subscription</h3>
                  <button onClick={() => setCurrentStep(2)} className="ml-auto text-xs text-violet-600 hover:text-violet-700">Edit</button>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Plan:</span><span className="font-medium text-gray-900">{selectedPlan.name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Billing:</span><span className="font-medium text-gray-900">{subscription.billingCycle}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Price:</span><span className="font-medium text-gray-900">KES {price.toLocaleString()}/{subscription.billingCycle === 'monthly' ? 'mo' : 'yr'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Trial:</span><span className="font-medium text-gray-900">{subscription.startTrial ? '14-day trial' : 'No trial'}</span></div>
                </div>
              </div>

              {/* Admin Summary */}
              <div className="border border-gray-200 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <UserPlus className="h-5 w-5 text-violet-600" />
                  <h3 className="font-semibold text-gray-900">Admin User</h3>
                  <button onClick={() => setCurrentStep(3)} className="ml-auto text-xs text-violet-600 hover:text-violet-700">Edit</button>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Name:</span><span className="font-medium text-gray-900">{admin.firstName} {admin.lastName}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Email:</span><span className="font-medium text-gray-900">{admin.email}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Role:</span><span className="font-medium text-gray-900">{admin.role.replace('_', ' ')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Invite:</span><span className="font-medium text-gray-900">{admin.sendInvite ? 'Will be sent' : 'Not sending'}</span></div>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Important</p>
                <p className="text-sm text-amber-700">Once activated, the tenant will receive access to the platform. Make sure all details are correct.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={goBack}
          disabled={currentStep === 0}
          className="flex items-center gap-2 px-5 py-2.5 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/tenants')} className="px-5 py-2.5 text-gray-500 hover:text-gray-700 font-medium">
            Cancel
          </button>
          {currentStep < steps.length - 1 ? (
            <button
              onClick={goNext}
              disabled={!validateStep(currentStep)}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Activate Tenant
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
