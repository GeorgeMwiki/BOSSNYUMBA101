/**
 * Conversation Orchestrator for BOSSNYUMBA
 * Handles multi-step conversational flows via WhatsApp
 * Implements Module A (Onboarding) workflows
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../logger.js';
import { MetaWhatsAppClient } from './meta-client.js';
import {
  ONBOARDING_TEMPLATES,
  GENERAL_TEMPLATES,
  renderTemplate,
  getTemplate,
  detectLanguage,
} from './templates.js';
import type {
  ConversationSession,
  ConversationState,
  ConversationContext,
  OnboardingContext,
  SupportedLanguage,
  IncomingMessage,
  InteractiveReply,
  MessageHistoryItem,
} from './types.js';

const logger = createLogger('ConversationOrchestrator');

// ============================================================================
// Session Store Interface
// ============================================================================

export interface SessionStore {
  get(phoneNumber: string): Promise<ConversationSession | null>;
  set(session: ConversationSession): Promise<void>;
  delete(phoneNumber: string): Promise<void>;
  getByTenantId(tenantId: string): Promise<ConversationSession | null>;
}

// ============================================================================
// In-Memory Session Store (for development)
// ============================================================================

export class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, ConversationSession>();
  private tenantIndex = new Map<string, string>();

  async get(phoneNumber: string): Promise<ConversationSession | null> {
    const session = this.sessions.get(phoneNumber);
    if (session && session.expiresAt > new Date()) {
      return session;
    }
    // Clean up expired session
    if (session) {
      this.sessions.delete(phoneNumber);
      if (session.tenantId) {
        this.tenantIndex.delete(session.tenantId);
      }
    }
    return null;
  }

  async set(session: ConversationSession): Promise<void> {
    this.sessions.set(session.phoneNumber, session);
    if (session.tenantId) {
      this.tenantIndex.set(session.tenantId, session.phoneNumber);
    }
  }

  async delete(phoneNumber: string): Promise<void> {
    const session = this.sessions.get(phoneNumber);
    if (session?.tenantId) {
      this.tenantIndex.delete(session.tenantId);
    }
    this.sessions.delete(phoneNumber);
  }

  async getByTenantId(tenantId: string): Promise<ConversationSession | null> {
    const phoneNumber = this.tenantIndex.get(tenantId);
    if (phoneNumber) {
      return this.get(phoneNumber);
    }
    return null;
  }
}

// ============================================================================
// Tenant Lookup Interface
// ============================================================================

export interface TenantLookup {
  findByPhone(phoneNumber: string): Promise<TenantInfo | null>;
  findById(tenantId: string): Promise<TenantInfo | null>;
  updateOnboardingStatus(tenantId: string, status: OnboardingStatus): Promise<void>;
}

export interface TenantInfo {
  tenantId: string;
  name: string;
  phoneNumber: string;
  email?: string;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitNumber: string;
  leaseStartDate?: string;
  onboardingStatus: OnboardingStatus;
  preferredLanguage?: SupportedLanguage;
}

export type OnboardingStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed';

// ============================================================================
// Conversation Orchestrator
// ============================================================================

export class ConversationOrchestrator {
  private whatsappClient: MetaWhatsAppClient;
  private sessionStore: SessionStore;
  private tenantLookup: TenantLookup;
  private sessionTimeoutMinutes: number;

  constructor(options: {
    whatsappClient: MetaWhatsAppClient;
    sessionStore: SessionStore;
    tenantLookup: TenantLookup;
    sessionTimeoutMinutes?: number;
  }) {
    this.whatsappClient = options.whatsappClient;
    this.sessionStore = options.sessionStore;
    this.tenantLookup = options.tenantLookup;
    this.sessionTimeoutMinutes = options.sessionTimeoutMinutes || 30;
  }

  // ============================================================================
  // Main Message Handler
  // ============================================================================

  /**
   * Process an incoming message and generate appropriate response
   */
  async handleMessage(message: IncomingMessage, senderName?: string): Promise<void> {
    const phoneNumber = message.from;
    
    logger.info('Processing incoming message', { 
      from: phoneNumber, 
      type: message.type,
      messageId: message.id 
    });

    // Mark message as read
    await this.whatsappClient.markAsRead(message.id);

    // Get or create session
    let session = await this.sessionStore.get(phoneNumber);
    const tenant = await this.tenantLookup.findByPhone(phoneNumber);

    if (!session) {
      session = await this.createNewSession(phoneNumber, tenant, senderName);
    } else {
      // Update session activity
      session.updatedAt = new Date();
      session.expiresAt = this.getExpirationDate();
    }

    // Add message to history
    this.addToHistory(session, message);

    // Route to appropriate handler based on state
    await this.routeMessage(session, message, tenant);

    // Save updated session
    await this.sessionStore.set(session);
  }

  /**
   * Route message to appropriate handler based on conversation state
   */
  private async routeMessage(
    session: ConversationSession,
    message: IncomingMessage,
    tenant: TenantInfo | null
  ): Promise<void> {
    const state = session.state;
    const text = this.extractTextContent(message);

    // Check for emergency keywords first
    if (text && this.containsEmergencyKeyword(text, session.language)) {
      logger.warn('Emergency keyword detected', { from: session.phoneNumber, text });
      // Will be handled by EmergencyProtocolHandler
      return;
    }

    // Route based on state
    switch (state) {
      case 'idle':
        await this.handleIdleState(session, message, tenant, text);
        break;

      case 'onboarding_welcome':
      case 'onboarding_language':
        await this.handleLanguageSelection(session, message);
        break;

      case 'onboarding_move_in_date':
        await this.handleMoveInDate(session, text);
        break;

      case 'onboarding_occupants':
        await this.handleOccupantsResponse(session, message);
        break;

      case 'onboarding_emergency_contact':
        await this.handleEmergencyContact(session, text);
        break;

      case 'onboarding_confirmation':
        await this.handleOnboardingConfirmation(session, message, tenant);
        break;

      case 'awaiting_response':
        await this.handleGenericResponse(session, message, tenant, text);
        break;

      default:
        await this.handleUnknownState(session, message);
    }
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  private async createNewSession(
    phoneNumber: string,
    tenant: TenantInfo | null,
    senderName?: string
  ): Promise<ConversationSession> {
    const session: ConversationSession = {
      id: uuidv4(),
      tenantId: tenant?.tenantId || '',
      phoneNumber,
      state: 'idle',
      language: tenant?.preferredLanguage || 'en',
      context: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: this.getExpirationDate(),
      messageHistory: [],
    };

    logger.info('Created new conversation session', { 
      sessionId: session.id, 
      phoneNumber,
      tenantId: tenant?.tenantId 
    });

    return session;
  }

  private getExpirationDate(): Date {
    return new Date(Date.now() + this.sessionTimeoutMinutes * 60 * 1000);
  }

  private addToHistory(session: ConversationSession, message: IncomingMessage): void {
    const historyItem: MessageHistoryItem = {
      id: message.id,
      direction: 'inbound',
      type: message.type as MessageHistoryItem['type'],
      content: this.extractTextContent(message) || `[${message.type}]`,
      timestamp: new Date(parseInt(message.timestamp) * 1000),
      status: 'delivered',
    };
    session.messageHistory.push(historyItem);

    // Keep only last 50 messages
    if (session.messageHistory.length > 50) {
      session.messageHistory = session.messageHistory.slice(-50);
    }
  }

  private extractTextContent(message: IncomingMessage): string | null {
    switch (message.type) {
      case 'text':
        return message.text?.body || null;
      case 'interactive':
        return message.interactive?.button_reply?.title || 
               message.interactive?.list_reply?.title || null;
      case 'button':
        return message.button?.text || null;
      default:
        return null;
    }
  }

  private getInteractiveReplyId(message: IncomingMessage): string | null {
    if (message.type === 'interactive' && message.interactive) {
      return message.interactive.button_reply?.id || 
             message.interactive.list_reply?.id || null;
    }
    if (message.type === 'button' && message.button) {
      return message.button.payload;
    }
    return null;
  }

  // ============================================================================
  // State Handlers
  // ============================================================================

  private async handleIdleState(
    session: ConversationSession,
    message: IncomingMessage,
    tenant: TenantInfo | null,
    text: string | null
  ): Promise<void> {
    // Detect language from message
    if (text) {
      session.language = detectLanguage(text);
    }

    // Check if this is a known tenant who needs onboarding
    if (tenant && tenant.onboardingStatus === 'pending') {
      await this.startOnboarding(session, tenant);
      return;
    }

    // Check for specific commands
    if (text) {
      const lowerText = text.toLowerCase();
      
      if (lowerText.includes('maintenance') || lowerText.includes('matengenezo')) {
        // Route to maintenance handler (will be handled separately)
        session.state = 'maintenance_intake';
        return;
      }

      if (lowerText.includes('rent') || lowerText.includes('pay') || 
          lowerText.includes('kodi') || lowerText.includes('lipa')) {
        // Handle rent/payment inquiry
        await this.handlePaymentInquiry(session, tenant);
        return;
      }
    }

    // Default greeting for known tenant
    if (tenant) {
      const greeting = renderTemplate(
        getTemplate(GENERAL_TEMPLATES.greeting, session.language) as string,
        { tenantName: tenant.name }
      );
      await this.whatsappClient.sendText({ to: session.phoneNumber, text: greeting });
    } else {
      // Unknown number
      const template = getTemplate(GENERAL_TEMPLATES.unknownCommand, session.language) as string;
      await this.whatsappClient.sendText({ to: session.phoneNumber, text: template });
    }

    session.state = 'awaiting_response';
  }

  // ============================================================================
  // Onboarding Flow (Module A)
  // ============================================================================

  /**
   * Start the onboarding flow for a new tenant
   */
  async startOnboarding(session: ConversationSession, tenant: TenantInfo): Promise<void> {
    logger.info('Starting onboarding flow', { tenantId: tenant.tenantId });

    // Initialize onboarding context
    session.context.onboarding = {
      tenantName: tenant.name,
      propertyId: tenant.propertyId,
      unitId: tenant.unitId,
      step: 1,
      completedSteps: [],
    };

    // Send welcome message
    const welcomeMessage = renderTemplate(
      getTemplate(ONBOARDING_TEMPLATES.welcome, session.language) as string,
      { propertyName: tenant.propertyName }
    );
    await this.whatsappClient.sendText({ to: session.phoneNumber, text: welcomeMessage });

    // Send language selection buttons
    const langTemplate = getTemplate(ONBOARDING_TEMPLATES.languageSelection, session.language);
    await this.whatsappClient.sendButtons(
      session.phoneNumber,
      (langTemplate as { body: string }).body,
      (langTemplate as { buttons: Array<{ id: string; title: string }> }).buttons
    );

    session.state = 'onboarding_language';
    
    // Update tenant status
    await this.tenantLookup.updateOnboardingStatus(tenant.tenantId, 'in_progress');
  }

  private async handleLanguageSelection(
    session: ConversationSession,
    message: IncomingMessage
  ): Promise<void> {
    const replyId = this.getInteractiveReplyId(message);
    const text = this.extractTextContent(message)?.toLowerCase();

    // Determine language selection
    if (replyId === 'lang_sw' || text?.includes('swahili') || text?.includes('kiswahili')) {
      session.language = 'sw';
    } else {
      session.language = 'en';
    }

    // Update context
    if (session.context.onboarding) {
      session.context.onboarding.preferredLanguage = session.language;
      session.context.onboarding.step = 2;
      session.context.onboarding.completedSteps.push('language');
    }

    // Ask for move-in date
    const moveInMessage = getTemplate(ONBOARDING_TEMPLATES.moveInDateRequest, session.language) as string;
    await this.whatsappClient.sendText({ to: session.phoneNumber, text: moveInMessage });

    session.state = 'onboarding_move_in_date';
  }

  private async handleMoveInDate(session: ConversationSession, text: string | null): Promise<void> {
    if (!text) {
      // Ask again
      const message = getTemplate(ONBOARDING_TEMPLATES.moveInDateRequest, session.language) as string;
      await this.whatsappClient.sendText({ to: session.phoneNumber, text: message });
      return;
    }

    // Parse date (supports DD/MM/YYYY, DD-MM-YYYY, etc.)
    const datePattern = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/;
    const match = text.match(datePattern);

    if (!match) {
      const errorMsg = session.language === 'sw'
        ? 'Samahani, sikuelewa tarehe hiyo. Tafadhali tumia muundo DD/MM/YYYY (mfano: 15/03/2026)'
        : 'Sorry, I couldn\'t understand that date. Please use DD/MM/YYYY format (e.g., 15/03/2026)';
      await this.whatsappClient.sendText({ to: session.phoneNumber, text: errorMsg });
      return;
    }

    const [, day, month, year] = match;
    const fullYear = year.length === 2 ? '20' + year : year;
    const moveInDate = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${fullYear}`;

    // Update context
    if (session.context.onboarding) {
      session.context.onboarding.moveInDate = moveInDate;
      session.context.onboarding.step = 3;
      session.context.onboarding.completedSteps.push('move_in_date');
    }

    // Send occupants message
    const occupantsMessage = renderTemplate(
      getTemplate(ONBOARDING_TEMPLATES.occupantsRequest, session.language) as string,
      { moveInDate }
    );
    await this.whatsappClient.sendText({ to: session.phoneNumber, text: occupantsMessage });

    // Send buttons
    const buttonTemplate = getTemplate(ONBOARDING_TEMPLATES.occupantsButtons, session.language);
    await this.whatsappClient.sendButtons(
      session.phoneNumber,
      (buttonTemplate as { body: string }).body,
      (buttonTemplate as { buttons: Array<{ id: string; title: string }> }).buttons
    );

    session.state = 'onboarding_occupants';
  }

  private async handleOccupantsResponse(
    session: ConversationSession,
    message: IncomingMessage
  ): Promise<void> {
    const replyId = this.getInteractiveReplyId(message);
    const text = this.extractTextContent(message);

    let occupants = 1;

    if (replyId === 'occupants_1' || text === '1') {
      occupants = 1;
    } else if (replyId === 'occupants_2' || text === '2') {
      occupants = 2;
    } else if (replyId === 'occupants_3_plus' || (text && parseInt(text) >= 3)) {
      occupants = text ? parseInt(text) || 3 : 3;
    } else if (text) {
      const num = parseInt(text);
      if (!isNaN(num) && num > 0) {
        occupants = num;
      }
    }

    // Update context
    if (session.context.onboarding) {
      session.context.onboarding.numberOfOccupants = occupants;
      session.context.onboarding.step = 4;
      session.context.onboarding.completedSteps.push('occupants');
    }

    // Ask for emergency contact
    const emergencyMessage = renderTemplate(
      getTemplate(ONBOARDING_TEMPLATES.emergencyContactRequest, session.language) as string,
      { occupants: occupants.toString() }
    );
    await this.whatsappClient.sendText({ to: session.phoneNumber, text: emergencyMessage });

    session.state = 'onboarding_emergency_contact';
  }

  private async handleEmergencyContact(
    session: ConversationSession,
    text: string | null
  ): Promise<void> {
    if (!text) {
      const errorMsg = session.language === 'sw'
        ? 'Tafadhali toa jina na nambari ya simu ya mtu wa kuwasiliana naye wakati wa dharura.'
        : 'Please provide the name and phone number of an emergency contact.';
      await this.whatsappClient.sendText({ to: session.phoneNumber, text: errorMsg });
      return;
    }

    // Parse name and phone (flexible format)
    const phonePattern = /\d{9,}/;
    const phoneMatch = text.match(phonePattern);
    
    if (!phoneMatch) {
      const errorMsg = session.language === 'sw'
        ? 'Sikuweza kupata nambari ya simu. Tafadhali jaribu tena kwa muundo: Jina, Simu'
        : 'I couldn\'t find a phone number. Please try again in format: Name, Phone';
      await this.whatsappClient.sendText({ to: session.phoneNumber, text: errorMsg });
      return;
    }

    const phone = phoneMatch[0];
    const name = text.replace(phone, '').replace(/[,\-]/g, '').trim() || 'Emergency Contact';

    // Update context
    if (session.context.onboarding) {
      session.context.onboarding.emergencyContactName = name;
      session.context.onboarding.emergencyContactPhone = phone;
      session.context.onboarding.step = 5;
      session.context.onboarding.completedSteps.push('emergency_contact');
    }

    // Show confirmation summary
    await this.showOnboardingConfirmation(session);
  }

  private async showOnboardingConfirmation(session: ConversationSession): Promise<void> {
    const ctx = session.context.onboarding;
    if (!ctx) return;

    const tenant = await this.tenantLookup.findById(session.tenantId);
    
    const summaryMessage = renderTemplate(
      getTemplate(ONBOARDING_TEMPLATES.confirmationSummary, session.language) as string,
      {
        propertyName: tenant?.propertyName || 'Your Property',
        unitNumber: tenant?.unitNumber || 'Your Unit',
        moveInDate: ctx.moveInDate || 'TBD',
        occupants: ctx.numberOfOccupants?.toString() || '1',
        emergencyContact: `${ctx.emergencyContactName || ''} (${ctx.emergencyContactPhone || ''})`,
      }
    );
    await this.whatsappClient.sendText({ to: session.phoneNumber, text: summaryMessage });

    // Send confirmation buttons
    const buttonTemplate = getTemplate(ONBOARDING_TEMPLATES.confirmationButtons, session.language);
    await this.whatsappClient.sendButtons(
      session.phoneNumber,
      (buttonTemplate as { body: string }).body,
      (buttonTemplate as { buttons: Array<{ id: string; title: string }> }).buttons
    );

    session.state = 'onboarding_confirmation';
  }

  private async handleOnboardingConfirmation(
    session: ConversationSession,
    message: IncomingMessage,
    tenant: TenantInfo | null
  ): Promise<void> {
    const replyId = this.getInteractiveReplyId(message);
    const text = this.extractTextContent(message)?.toLowerCase();

    if (replyId === 'confirm_no' || text?.includes('no') || text?.includes('hapana') || text?.includes('edit')) {
      // Restart from beginning
      if (session.context.onboarding) {
        session.context.onboarding.step = 1;
        session.context.onboarding.completedSteps = [];
      }

      const restartMsg = session.language === 'sw'
        ? 'Sawa, tuanze tena. Unapendelea lugha gani?'
        : 'Okay, let\'s start over. What language do you prefer?';
      await this.whatsappClient.sendText({ to: session.phoneNumber, text: restartMsg });
      
      const langTemplate = getTemplate(ONBOARDING_TEMPLATES.languageSelection, session.language);
      await this.whatsappClient.sendButtons(
        session.phoneNumber,
        (langTemplate as { body: string }).body,
        (langTemplate as { buttons: Array<{ id: string; title: string }> }).buttons
      );

      session.state = 'onboarding_language';
      return;
    }

    // Confirmed - complete onboarding
    if (session.context.onboarding) {
      session.context.onboarding.step = 6;
      session.context.onboarding.completedSteps.push('confirmation');
    }

    // Send completion message
    const completeMessage = renderTemplate(
      getTemplate(ONBOARDING_TEMPLATES.onboardingComplete, session.language) as string,
      { tenantName: tenant?.name || 'valued tenant' }
    );
    await this.whatsappClient.sendText({ to: session.phoneNumber, text: completeMessage });

    // Update tenant onboarding status
    if (tenant) {
      await this.tenantLookup.updateOnboardingStatus(tenant.tenantId, 'completed');
    }

    session.state = 'onboarding_complete';

    logger.info('Onboarding completed', { 
      tenantId: tenant?.tenantId,
      phoneNumber: session.phoneNumber 
    });
  }

  // ============================================================================
  // Other Handlers
  // ============================================================================

  private async handlePaymentInquiry(
    session: ConversationSession,
    tenant: TenantInfo | null
  ): Promise<void> {
    const msg = session.language === 'sw'
      ? `💰 *Maelezo ya Malipo*\n\nHabari ${tenant?.name || ''}!\n\nKwa maelezo ya kodi na malipo, jibu "salio" kupata salio lako la sasa au "lipa" kupata maelekezo ya malipo.`
      : `💰 *Payment Information*\n\nHi ${tenant?.name || ''}!\n\nFor rent and payment details, reply "balance" to get your current balance or "pay" for payment instructions.`;

    await this.whatsappClient.sendText({ to: session.phoneNumber, text: msg });
    session.state = 'awaiting_response';
  }

  private async handleGenericResponse(
    session: ConversationSession,
    message: IncomingMessage,
    tenant: TenantInfo | null,
    text: string | null
  ): Promise<void> {
    // Route based on text content
    if (text) {
      const lowerText = text.toLowerCase();

      if (lowerText.includes('maintenance') || lowerText.includes('matengenezo') ||
          lowerText.includes('repair') || lowerText.includes('broken') || lowerText.includes('leak')) {
        session.state = 'maintenance_intake';
        return;
      }

      if (lowerText.includes('thank') || lowerText.includes('asante')) {
        const response = session.language === 'sw' 
          ? 'Karibu sana! Niko hapa ukihitaji msaada wowote. 🏠'
          : 'You\'re welcome! I\'m here if you need any help. 🏠';
        await this.whatsappClient.sendText({ to: session.phoneNumber, text: response });
        session.state = 'idle';
        return;
      }
    }

    // Default response
    const template = getTemplate(GENERAL_TEMPLATES.unknownCommand, session.language) as string;
    await this.whatsappClient.sendText({ to: session.phoneNumber, text: template });
  }

  private async handleUnknownState(
    session: ConversationSession,
    message: IncomingMessage
  ): Promise<void> {
    logger.warn('Unknown conversation state', { state: session.state });
    
    const template = getTemplate(GENERAL_TEMPLATES.sessionExpired, session.language) as string;
    await this.whatsappClient.sendText({ to: session.phoneNumber, text: template });
    
    session.state = 'idle';
    session.context = {};
  }

  // ============================================================================
  // Emergency Detection
  // ============================================================================

  private containsEmergencyKeyword(text: string, language: SupportedLanguage): boolean {
    const config = this.whatsappClient.getConfig();
    const keywords = config.emergencyKeywords[language] || [];
    const lowerText = text.toLowerCase();
    
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Send a proactive message to a tenant
   */
  async sendProactiveMessage(
    phoneNumber: string,
    message: string,
    language: SupportedLanguage = 'en'
  ): Promise<void> {
    await this.whatsappClient.sendText({ to: phoneNumber, text: message });
    logger.info('Sent proactive message', { to: phoneNumber });
  }

  /**
   * Initiate onboarding for a new tenant
   */
  async initiateOnboarding(tenant: TenantInfo): Promise<void> {
    let session = await this.sessionStore.get(tenant.phoneNumber);
    
    if (!session) {
      session = await this.createNewSession(tenant.phoneNumber, tenant);
    }

    await this.startOnboarding(session, tenant);
    await this.sessionStore.set(session);
  }

  /**
   * Get current session for a phone number
   */
  async getSession(phoneNumber: string): Promise<ConversationSession | null> {
    return this.sessionStore.get(phoneNumber);
  }

  /**
   * Clear session for a phone number
   */
  async clearSession(phoneNumber: string): Promise<void> {
    await this.sessionStore.delete(phoneNumber);
    logger.info('Session cleared', { phoneNumber });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createConversationOrchestrator(options: {
  whatsappClient: MetaWhatsAppClient;
  sessionStore?: SessionStore;
  tenantLookup: TenantLookup;
  sessionTimeoutMinutes?: number;
}): ConversationOrchestrator {
  return new ConversationOrchestrator({
    whatsappClient: options.whatsappClient,
    sessionStore: options.sessionStore || new InMemorySessionStore(),
    tenantLookup: options.tenantLookup,
    sessionTimeoutMinutes: options.sessionTimeoutMinutes,
  });
}
