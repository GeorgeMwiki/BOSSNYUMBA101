export type Locale = 'en' | 'sw';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'sw'];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  sw: 'Kiswahili',
};

export const DEFAULT_LOCALE: Locale = 'en';

export type TranslationDictionary = {
  common: CommonTranslations;
  customer: CustomerTranslations;
  estateManager: EstateManagerTranslations;
  owner: OwnerTranslations;
  admin: AdminTranslations;
  auth: AuthTranslations;
  payments: PaymentTranslations;
  maintenance: MaintenanceTranslations;
  leases: LeaseTranslations;
  properties: PropertyTranslations;
  notifications: NotificationTranslations;
};

export type CommonTranslations = {
  appName: string;
  tagline: string;
  nav: {
    home: string;
    dashboard: string;
    settings: string;
    profile: string;
    help: string;
    logout: string;
    back: string;
    notifications: string;
    messages: string;
    search: string;
  };
  actions: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    submit: string;
    confirm: string;
    reject: string;
    approve: string;
    close: string;
    open: string;
    view: string;
    download: string;
    upload: string;
    retry: string;
    refresh: string;
    filter: string;
    sort: string;
    export: string;
    import: string;
    print: string;
    share: string;
    copy: string;
    add: string;
    remove: string;
    update: string;
    send: string;
    apply: string;
    clear: string;
    selectAll: string;
    deselectAll: string;
    loadMore: string;
    showMore: string;
    showLess: string;
  };
  status: {
    active: string;
    inactive: string;
    pending: string;
    approved: string;
    rejected: string;
    completed: string;
    cancelled: string;
    expired: string;
    overdue: string;
    draft: string;
    inProgress: string;
    onHold: string;
    resolved: string;
    closed: string;
    open: string;
    scheduled: string;
    archived: string;
  };
  time: {
    today: string;
    yesterday: string;
    tomorrow: string;
    thisWeek: string;
    lastWeek: string;
    thisMonth: string;
    lastMonth: string;
    thisYear: string;
    daysAgo: string;
    hoursAgo: string;
    minutesAgo: string;
    justNow: string;
    due: string;
    overdue: string;
  };
  errors: {
    generic: string;
    notFound: string;
    unauthorized: string;
    forbidden: string;
    networkError: string;
    serverError: string;
    validationError: string;
    requiredField: string;
    invalidEmail: string;
    invalidPhone: string;
    fileTooLarge: string;
    sessionExpired: string;
  };
  empty: {
    noData: string;
    noResults: string;
    noNotifications: string;
    noMessages: string;
  };
  currency: {
    kes: string;
    usd: string;
    tzs: string;
  };
  units: {
    bedroom: string;
    bedrooms: string;
    bathroom: string;
    bathrooms: string;
    sqft: string;
    sqm: string;
    floor: string;
  };
};

export type AuthTranslations = {
  login: {
    title: string;
    subtitle: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    submitButton: string;
    forgotPassword: string;
    noAccount: string;
    signUp: string;
    orContinueWith: string;
    whatsappLogin: string;
    otpLogin: string;
    rememberMe: string;
  };
  register: {
    title: string;
    subtitle: string;
    fullNameLabel: string;
    fullNamePlaceholder: string;
    submitButton: string;
    hasAccount: string;
    signIn: string;
    termsAgree: string;
    termsLink: string;
    privacyLink: string;
  };
  otp: {
    title: string;
    subtitle: string;
    enterCode: string;
    resendCode: string;
    resendIn: string;
    verifyButton: string;
    didNotReceive: string;
  };
  whatsapp: {
    title: string;
    subtitle: string;
    sendCode: string;
    openWhatsapp: string;
  };
};

export type CustomerTranslations = {
  home: {
    greeting: string;
    rentDue: string;
    quickActions: string;
    payRent: string;
    maintenance: string;
    documents: string;
    community: string;
    recentActivity: string;
    upcomingPayments: string;
    activeRequests: string;
    announcements: string;
  };
  payments: {
    title: string;
    payNow: string;
    paymentHistory: string;
    amountDue: string;
    dueDate: string;
    payVia: string;
    mpesa: string;
    bankTransfer: string;
    card: string;
    paymentPlan: string;
    invoice: string;
    receipt: string;
    balance: string;
    totalPaid: string;
    outstanding: string;
    paymentSuccess: string;
    paymentFailed: string;
    processingPayment: string;
    enterAmount: string;
    selectMethod: string;
    confirmPayment: string;
    transactionId: string;
    paidOn: string;
  };
  maintenance: {
    title: string;
    newRequest: string;
    myRequests: string;
    category: string;
    description: string;
    priority: string;
    urgency: {
      low: string;
      medium: string;
      high: string;
      emergency: string;
    };
    categories: {
      plumbing: string;
      electrical: string;
      hvac: string;
      appliance: string;
      structural: string;
      pest: string;
      security: string;
      cleaning: string;
      painting: string;
      other: string;
    };
    statusLabels: {
      submitted: string;
      assigned: string;
      inProgress: string;
      awaitingParts: string;
      completed: string;
      closed: string;
    };
    addPhotos: string;
    descriptionPlaceholder: string;
    preferredDate: string;
    accessInstructions: string;
    giveFeedback: string;
    rating: string;
  };
  lease: {
    title: string;
    currentLease: string;
    startDate: string;
    endDate: string;
    monthlyRent: string;
    deposit: string;
    renewal: string;
    moveOut: string;
    leaseDocuments: string;
    viewLease: string;
    requestRenewal: string;
    noticePeriod: string;
    moveOutDate: string;
    moveOutReason: string;
  };
  onboarding: {
    welcome: string;
    welcomeSubtitle: string;
    steps: {
      documents: string;
      eSign: string;
      inspection: string;
      orientation: string;
      utilities: string;
      complete: string;
    };
    uploadId: string;
    signLease: string;
    scheduleInspection: string;
    completeOrientation: string;
    setupUtilities: string;
    allDone: string;
  };
  community: {
    title: string;
    rules: string;
    announcements: string;
    events: string;
    neighbors: string;
    noisePolicy: string;
    petPolicy: string;
    parkingRules: string;
    guestPolicy: string;
  };
  documents: {
    title: string;
    myDocuments: string;
    leaseAgreement: string;
    idCopy: string;
    moveInReport: string;
    receipts: string;
    uploadDocument: string;
    downloadAll: string;
  };
  feedback: {
    title: string;
    howWasService: string;
    rateExperience: string;
    leaveComment: string;
    submitFeedback: string;
    thankYou: string;
    history: string;
  };
  emergencies: {
    title: string;
    reportEmergency: string;
    callManager: string;
    fire: string;
    flood: string;
    breakIn: string;
    medical: string;
    gasLeak: string;
    powerOutage: string;
    emergencyContacts: string;
  };
  utilities: {
    title: string;
    meterReading: string;
    submitReading: string;
    currentUsage: string;
    water: string;
    electricity: string;
    gas: string;
    lastReading: string;
    previousReadings: string;
  };
  marketplace: {
    title: string;
    services: string;
    offers: string;
    nearbyServices: string;
  };
  settings: {
    title: string;
    notificationPreferences: string;
    pushNotifications: string;
    emailNotifications: string;
    smsNotifications: string;
    appLanguage: string;
    currencyDisplay: string;
    receiveAppNotifications: string;
    rentRemindersLeaseUpdates: string;
    urgentAlertsViaText: string;
  };
  profile: {
    title: string;
    editProfile: string;
    personalInfo: string;
    contactInfo: string;
    emergencyContact: string;
    changePassword: string;
    deleteAccount: string;
  };
  support: {
    title: string;
    faq: string;
    contactUs: string;
    liveChat: string;
    callSupport: string;
    emailSupport: string;
  };
};

export type EstateManagerTranslations = {
  dashboard: {
    title: string;
    totalUnits: string;
    occupiedUnits: string;
    vacantUnits: string;
    occupancyRate: string;
    rentCollected: string;
    rentOutstanding: string;
    openWorkOrders: string;
    pendingInspections: string;
    expiringLeases: string;
    todaySchedule: string;
    quickActions: string;
    recentActivity: string;
  };
  properties: {
    title: string;
    addProperty: string;
    editProperty: string;
    propertyDetails: string;
    address: string;
    type: string;
    totalUnits: string;
    amenities: string;
    photos: string;
    documents: string;
  };
  units: {
    title: string;
    addUnit: string;
    editUnit: string;
    unitNumber: string;
    unitType: string;
    floorPlan: string;
    rentAmount: string;
    status: string;
    tenant: string;
    vacant: string;
    occupied: string;
    underMaintenance: string;
  };
  customers: {
    title: string;
    addCustomer: string;
    editCustomer: string;
    customerDetails: string;
    onboarding: string;
    leaseHistory: string;
    paymentHistory: string;
    maintenanceHistory: string;
    contactInfo: string;
    emergencyContact: string;
    documents: string;
    moveIn: string;
    moveOut: string;
    activeCustomers: string;
    formerCustomers: string;
  };
  leases: {
    title: string;
    createLease: string;
    leaseDetails: string;
    renewLease: string;
    terminateLease: string;
    startDate: string;
    endDate: string;
    monthlyRent: string;
    deposit: string;
    terms: string;
    active: string;
    expiring: string;
    expired: string;
    draftLease: string;
  };
  workOrders: {
    title: string;
    createWorkOrder: string;
    assignVendor: string;
    triage: string;
    priority: string;
    category: string;
    estimatedCost: string;
    actualCost: string;
    completionDate: string;
    vendor: string;
    notes: string;
  };
  inspections: {
    title: string;
    scheduleInspection: string;
    conductInspection: string;
    inspectionReport: string;
    moveInInspection: string;
    moveOutInspection: string;
    routineInspection: string;
    condition: string;
    photos: string;
    notes: string;
    findings: string;
  };
  collections: {
    title: string;
    collectionRate: string;
    overdueAccounts: string;
    sendReminder: string;
    paymentArrangement: string;
    escalate: string;
  };
  announcements: {
    title: string;
    createAnnouncement: string;
    editAnnouncement: string;
    recipients: string;
    allResidents: string;
    specificBuilding: string;
    scheduleSend: string;
    sendNow: string;
  };
  vendors: {
    title: string;
    addVendor: string;
    vendorDetails: string;
    specialty: string;
    rating: string;
    contactInfo: string;
    workHistory: string;
    activeContracts: string;
  };
  payments: {
    title: string;
    recordPayment: string;
    receivePayment: string;
    createInvoice: string;
    viewInvoice: string;
    paymentMethod: string;
    referenceNumber: string;
    reconcile: string;
    pending: string;
    confirmed: string;
    failed: string;
  };
  reports: {
    title: string;
    generateReport: string;
    scheduledReports: string;
    occupancyReport: string;
    financialReport: string;
    maintenanceReport: string;
    tenantReport: string;
    exportPdf: string;
    exportExcel: string;
    dateRange: string;
  };
  calendar: {
    title: string;
    events: string;
    availability: string;
    scheduleEvent: string;
    inspectionSchedule: string;
    maintenanceSchedule: string;
    leaseRenewals: string;
  };
  messaging: {
    title: string;
    newMessage: string;
    inbox: string;
    sent: string;
    broadcast: string;
    selectRecipient: string;
    typeMessage: string;
  };
  sla: {
    title: string;
    responseTime: string;
    resolutionTime: string;
    complianceRate: string;
    breaches: string;
  };
  settings: {
    title: string;
    profile: string;
    notifications: string;
    security: string;
    help: string;
    twoFactor: string;
    changePassword: string;
  };
  utilities: {
    title: string;
    readings: string;
    bills: string;
    meterNumber: string;
    readingDate: string;
    consumption: string;
    rate: string;
    totalCharge: string;
  };
  schedule: {
    title: string;
    todayTasks: string;
    upcomingTasks: string;
    completedTasks: string;
  };
};

export type OwnerTranslations = {
  dashboard: {
    title: string;
    portfolioValue: string;
    monthlyIncome: string;
    monthlyExpenses: string;
    netIncome: string;
    occupancyRate: string;
    totalProperties: string;
    totalUnits: string;
    activeLeases: string;
    performanceSummary: string;
  };
  portfolio: {
    title: string;
    properties: string;
    performance: string;
    growth: string;
    addProperty: string;
    roi: string;
    appreciation: string;
    cashFlow: string;
    vacancy: string;
    marketValue: string;
  };
  analytics: {
    title: string;
    revenue: string;
    expenses: string;
    occupancy: string;
    trends: string;
    comparison: string;
    forecast: string;
    byProperty: string;
    byPeriod: string;
    revenueGrowth: string;
    expenseBreakdown: string;
    occupancyTrend: string;
  };
  budgets: {
    title: string;
    createBudget: string;
    editBudget: string;
    forecast: string;
    actual: string;
    variance: string;
    byCategory: string;
    annualBudget: string;
    monthlyBudget: string;
    capitalExpenses: string;
    operatingExpenses: string;
  };
  tenants: {
    title: string;
    tenantDetails: string;
    communications: string;
    paymentHistory: string;
    satisfactionScore: string;
    retentionRate: string;
    averageTenancy: string;
  };
  vendors: {
    title: string;
    vendorDetails: string;
    contracts: string;
    performance: string;
    spending: string;
    renewContract: string;
    terminateContract: string;
  };
  compliance: {
    title: string;
    licenses: string;
    insurance: string;
    inspections: string;
    expiringDocuments: string;
    renewalDue: string;
    compliant: string;
    nonCompliant: string;
    dueForRenewal: string;
  };
};

export type AdminTranslations = {
  dashboard: {
    title: string;
    platformOverview: string;
    totalTenants: string;
    totalUsers: string;
    totalProperties: string;
    monthlyRevenue: string;
    systemHealth: string;
    activeSubscriptions: string;
  };
  platform: {
    title: string;
    overview: string;
    billing: string;
    subscriptions: string;
    featureFlags: string;
    systemStatus: string;
    uptime: string;
    apiUsage: string;
    storageUsage: string;
  };
  communications: {
    title: string;
    broadcasts: string;
    campaigns: string;
    templates: string;
    createBroadcast: string;
    createCampaign: string;
    createTemplate: string;
    sent: string;
    scheduled: string;
    draft: string;
  };
  compliance: {
    title: string;
    dataRequests: string;
    documents: string;
    auditLog: string;
    gdprRequests: string;
    exportData: string;
    deleteData: string;
    retentionPolicy: string;
  };
  integrations: {
    title: string;
    apiKeys: string;
    webhooks: string;
    generateKey: string;
    revokeKey: string;
    configureWebhook: string;
    testWebhook: string;
    activeIntegrations: string;
    availableIntegrations: string;
  };
  analytics: {
    title: string;
    usage: string;
    growth: string;
    exports: string;
    userGrowth: string;
    revenueGrowth: string;
    featureAdoption: string;
    topTenants: string;
    exportReport: string;
  };
};

export type PaymentTranslations = {
  methods: {
    mpesa: string;
    mpesaDescription: string;
    bankTransfer: string;
    bankTransferDescription: string;
    card: string;
    cardDescription: string;
    cash: string;
    cashDescription: string;
    airtelMoney: string;
    tigoPesa: string;
  };
  status: {
    pending: string;
    processing: string;
    completed: string;
    failed: string;
    refunded: string;
    cancelled: string;
  };
  labels: {
    amount: string;
    date: string;
    reference: string;
    description: string;
    from: string;
    to: string;
    method: string;
    status: string;
    receipt: string;
    invoice: string;
  };
};

export type MaintenanceTranslations = {
  priority: {
    low: string;
    medium: string;
    high: string;
    critical: string;
    emergency: string;
  };
  status: {
    new: string;
    assigned: string;
    inProgress: string;
    awaitingParts: string;
    completed: string;
    closed: string;
    cancelled: string;
  };
  categories: {
    plumbing: string;
    electrical: string;
    hvac: string;
    appliance: string;
    structural: string;
    pest: string;
    security: string;
    cleaning: string;
    painting: string;
    roofing: string;
    flooring: string;
    windows: string;
    doors: string;
    landscaping: string;
    other: string;
  };
};

export type LeaseTranslations = {
  status: {
    draft: string;
    active: string;
    expiring: string;
    expired: string;
    terminated: string;
    renewed: string;
  };
  type: {
    fixed: string;
    monthToMonth: string;
    shortTerm: string;
    commercial: string;
  };
  labels: {
    startDate: string;
    endDate: string;
    monthlyRent: string;
    securityDeposit: string;
    noticePeriod: string;
    terms: string;
    tenant: string;
    unit: string;
    property: string;
    signedDate: string;
  };
};

export type PropertyTranslations = {
  type: {
    apartment: string;
    house: string;
    commercial: string;
    townhouse: string;
    studio: string;
    penthouse: string;
    bedsitter: string;
    singleRoom: string;
  };
  amenities: {
    parking: string;
    security: string;
    gym: string;
    pool: string;
    garden: string;
    elevator: string;
    laundry: string;
    wifi: string;
    generator: string;
    waterTank: string;
    cctv: string;
    playground: string;
    balcony: string;
    rooftop: string;
  };
};

export type NotificationTranslations = {
  types: {
    rentDue: string;
    rentOverdue: string;
    paymentReceived: string;
    maintenanceUpdate: string;
    leaseExpiring: string;
    announcement: string;
    message: string;
    inspection: string;
    emergency: string;
    welcome: string;
  };
  preferences: {
    push: string;
    email: string;
    sms: string;
    whatsapp: string;
  };
};

// Utility type to get all nested keys as dot notation
type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<TranslationDictionary>;
