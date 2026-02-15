/**
 * WhatsApp Webhook Router for BOSSNYUMBA
 * Express router for handling WhatsApp Business API webhooks
 * Includes verification, message routing, and status updates
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createLogger } from '../logger.js';
import { MetaWhatsAppClient } from './meta-client.js';
import { ConversationOrchestrator, TenantLookup, SessionStore } from './conversation-orchestrator.js';
import { MaintenanceRequestHandler, WorkOrderService, TranscriptionService } from './maintenance-handler.js';
import { FeedbackCollector, FeedbackService } from './feedback-collector.js';
import { EmergencyProtocolHandler, EmergencyService } from './emergency-handler.js';
import type {
  IncomingMessage,
  MessageStatusUpdate,
  WhatsAppWebhookPayload,
  ConversationSession,
  EmergencyContact,
  SupportedLanguage,
} from './types.js';
import { getEmergencyKeywords } from './templates.js';

const logger = createLogger('WhatsAppWebhook');

// ============================================================================
// Webhook Router Options
// ============================================================================

export interface WebhookRouterOptions {
  whatsappClient: MetaWhatsAppClient;
  tenantLookup: TenantLookup;
  sessionStore: SessionStore;
  workOrderService: WorkOrderService;
  feedbackService: FeedbackService;
  emergencyService: EmergencyService;
  transcriptionService?: TranscriptionService;
  defaultEmergencyContacts?: EmergencyContact[];
  validateSignature?: boolean;
}

// ============================================================================
// Message Status Handler Interface
// ============================================================================

export interface MessageStatusHandler {
  onSent?(messageId: string, recipientId: string): Promise<void>;
  onDelivered?(messageId: string, recipientId: string): Promise<void>;
  onRead?(messageId: string, recipientId: string): Promise<void>;
  onFailed?(messageId: string, recipientId: string, error: string): Promise<void>;
}

// ============================================================================
// Webhook Router Factory
// ============================================================================

export function createWebhookRouter(options: WebhookRouterOptions): Router {
  const router = Router();
  
  const {
    whatsappClient,
    tenantLookup,
    sessionStore,
    workOrderService,
    feedbackService,
    emergencyService,
    transcriptionService,
    defaultEmergencyContacts = [],
    validateSignature = true,
  } = options;

  // Initialize handlers
  const orchestrator = new ConversationOrchestrator({
    whatsappClient,
    sessionStore,
    tenantLookup,
    sessionTimeoutMinutes: 30,
  });

  const maintenanceHandler = new MaintenanceRequestHandler({
    whatsappClient,
    workOrderService,
    transcriptionService,
  });

  const feedbackCollector = new FeedbackCollector({
    whatsappClient,
    feedbackService,
  });

  const emergencyHandler = new EmergencyProtocolHandler({
    whatsappClient,
    emergencyService,
    emergencyKeywords: getEmergencyKeywords(),
    defaultEmergencyContacts,
  });

  // Message status handler (can be overridden)
  let statusHandler: MessageStatusHandler = {};

  // ============================================================================
  // Middleware: Signature Validation
  // ============================================================================

  const validateWebhookSignature = (req: Request, res: Response, next: NextFunction): void => {
    if (!validateSignature) {
      next();
      return;
    }

    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) {
      logger.warn('Missing webhook signature');
      res.status(401).json({ error: 'Missing signature' });
      return;
    }

    const rawBody = (req as Request & { rawBody?: string }).rawBody;
    if (!rawBody) {
      logger.warn('Missing raw body for signature validation');
      res.status(400).json({ error: 'Missing body' });
      return;
    }

    const isValid = whatsappClient.validateWebhookSignature(rawBody, signature);
    if (!isValid) {
      logger.warn('Invalid webhook signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    next();
  };

  // ============================================================================
  // GET /webhook - Verification Endpoint
  // ============================================================================

  router.get('/webhook', (req: Request, res: Response): void => {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    logger.info('Webhook verification request', { mode });

    const result = whatsappClient.verifyWebhook(mode, token, challenge);
    
    if (result) {
      logger.info('Webhook verified successfully');
      res.status(200).send(result);
    } else {
      logger.warn('Webhook verification failed');
      res.status(403).send('Forbidden');
    }
  });

  // ============================================================================
  // POST /webhook - Message & Status Handler
  // ============================================================================

  router.post('/webhook', validateWebhookSignature, async (req: Request, res: Response): Promise<void> => {
    // Always respond quickly to avoid timeouts
    res.status(200).send('EVENT_RECEIVED');

    try {
      const body = req.body as WhatsAppWebhookPayload;
      
      // Parse the webhook payload
      const parsed = whatsappClient.parseWebhookPayload(body);

      // Process messages
      for (const message of parsed.messages) {
        // Find contact name
        const contactName = parsed.contacts.find(c => c.wa_id === message.from)?.name;
        
        // Process asynchronously
        processMessage(message, contactName).catch(error => {
          logger.error('Failed to process message', { 
            messageId: message.id, 
            error 
          });
        });
      }

      // Process status updates
      for (const status of parsed.statuses) {
        processStatus(status).catch(error => {
          logger.error('Failed to process status', { 
            messageId: status.id, 
            error 
          });
        });
      }
    } catch (error) {
      logger.error('Webhook processing error', { error });
    }
  });

  // ============================================================================
  // Message Processing
  // ============================================================================

  async function processMessage(message: IncomingMessage, senderName?: string): Promise<void> {
    const phoneNumber = message.from;
    
    logger.info('Processing message', {
      from: phoneNumber,
      type: message.type,
      messageId: message.id,
    });

    // Get or create session
    let session = await sessionStore.get(phoneNumber);
    const tenant = await tenantLookup.findByPhone(phoneNumber);

    if (!session) {
      session = createNewSession(phoneNumber, tenant, senderName);
      await sessionStore.set(session);
    }

    // Check for emergency first (highest priority)
    const text = extractTextContent(message);
    if (text) {
      const emergencyCheck = emergencyHandler.detectEmergency(text, session.language);
      if (emergencyCheck.isEmergency && emergencyCheck.confidence === 'high') {
        await emergencyHandler.handleMessage(session, message);
        await sessionStore.set(session);
        return;
      }
    }

    // Route based on session state
    const state = session.state;

    // Maintenance flow states
    if (state.startsWith('maintenance_')) {
      await maintenanceHandler.handleMessage(session, message);
      await sessionStore.set(session);
      return;
    }

    // Feedback flow states
    if (state.startsWith('feedback_')) {
      await feedbackCollector.handleMessage(session, message);
      await sessionStore.set(session);
      return;
    }

    // Emergency flow states
    if (state === 'emergency_active') {
      await emergencyHandler.handleMessage(session, message);
      await sessionStore.set(session);
      return;
    }

    // Check for command keywords
    if (text) {
      const lowerText = text.toLowerCase();

      // Maintenance keywords
      if (lowerText.includes('maintenance') || lowerText.includes('repair') ||
          lowerText.includes('broken') || lowerText.includes('leak') ||
          lowerText.includes('matengenezo') || lowerText.includes('ukarabati')) {
        session.state = 'maintenance_intake';
        await maintenanceHandler.startMaintenanceFlow(session);
        await sessionStore.set(session);
        return;
      }

      // Feedback keywords
      if (lowerText.includes('feedback') || lowerText.includes('complaint') ||
          lowerText.includes('maoni') || lowerText.includes('malalamiko')) {
        await feedbackCollector.startFeedbackFlow(session, 'general');
        await sessionStore.set(session);
        return;
      }
    }

    // Default to conversation orchestrator
    await orchestrator.handleMessage(message, senderName);
    
    // Refresh session after orchestrator processing
    const updatedSession = await sessionStore.get(phoneNumber);
    if (updatedSession) {
      session = updatedSession;
    }
    await sessionStore.set(session);
  }

  // ============================================================================
  // Status Processing
  // ============================================================================

  async function processStatus(status: MessageStatusUpdate): Promise<void> {
    logger.debug('Processing status update', {
      messageId: status.id,
      status: status.status,
      recipientId: status.recipient_id,
    });

    switch (status.status) {
      case 'sent':
        await statusHandler.onSent?.(status.id, status.recipient_id);
        break;
      case 'delivered':
        await statusHandler.onDelivered?.(status.id, status.recipient_id);
        break;
      case 'read':
        await statusHandler.onRead?.(status.id, status.recipient_id);
        break;
      case 'failed':
        const errorMsg = status.errors?.[0]?.message || 'Unknown error';
        await statusHandler.onFailed?.(status.id, status.recipient_id, errorMsg);
        break;
    }
  }

  // ============================================================================
  // Helper Functions
  // ============================================================================

  function createNewSession(
    phoneNumber: string,
    tenant: Awaited<ReturnType<TenantLookup['findByPhone']>>,
    senderName?: string
  ): ConversationSession {
    const { v4: uuidv4 } = require('uuid');
    
    return {
      id: uuidv4(),
      tenantId: tenant?.tenantId || '',
      phoneNumber,
      state: 'idle',
      language: (tenant?.preferredLanguage || 'en') as SupportedLanguage,
      context: {
        onboarding: tenant ? {
          tenantName: tenant.name,
          propertyId: tenant.propertyId,
          unitId: tenant.unitId,
          step: 0,
          completedSteps: [],
        } : undefined,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      messageHistory: [],
    };
  }

  function extractTextContent(message: IncomingMessage): string | null {
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

  // ============================================================================
  // Additional Endpoints
  // ============================================================================

  /**
   * Health check endpoint
   */
  router.get('/health', (req: Request, res: Response): void => {
    res.json({
      status: 'ok',
      service: 'whatsapp-webhook',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Send proactive message (internal API)
   */
  router.post('/send', async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber, message, type = 'text' } = req.body;

      if (!phoneNumber || !message) {
        res.status(400).json({ error: 'Missing phoneNumber or message' });
        return;
      }

      if (type === 'text') {
        const result = await whatsappClient.sendText({ to: phoneNumber, text: message });
        res.json({ success: true, messageId: result.messages[0]?.id });
      } else {
        res.status(400).json({ error: 'Unsupported message type' });
      }
    } catch (error) {
      logger.error('Failed to send message', { error });
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  /**
   * Send template message (internal API)
   */
  router.post('/send-template', async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber, templateName, languageCode, components } = req.body;

      if (!phoneNumber || !templateName) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const result = await whatsappClient.sendTemplate({
        to: phoneNumber,
        templateName,
        languageCode: languageCode || 'en',
        components,
      });

      res.json({ success: true, messageId: result.messages[0]?.id });
    } catch (error) {
      logger.error('Failed to send template', { error });
      res.status(500).json({ error: 'Failed to send template' });
    }
  });

  /**
   * Initiate onboarding for a tenant
   */
  router.post('/initiate-onboarding', async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.body;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing tenantId' });
        return;
      }

      const tenant = await tenantLookup.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      await orchestrator.initiateOnboarding(tenant);
      res.json({ success: true, message: 'Onboarding initiated' });
    } catch (error) {
      logger.error('Failed to initiate onboarding', { error });
      res.status(500).json({ error: 'Failed to initiate onboarding' });
    }
  });

  /**
   * Send feedback check-in
   */
  router.post('/send-checkin', async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber, tenantName, propertyName, type, language } = req.body;

      if (!phoneNumber || !tenantName || !propertyName || !type) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      if (type === 'day3') {
        await feedbackCollector.sendDay3CheckIn(phoneNumber, tenantName, propertyName, language || 'en');
      } else if (type === 'day10') {
        await feedbackCollector.sendDay10CheckIn(phoneNumber, tenantName, propertyName, language || 'en');
      } else {
        res.status(400).json({ error: 'Invalid check-in type' });
        return;
      }

      res.json({ success: true, message: `${type} check-in sent` });
    } catch (error) {
      logger.error('Failed to send check-in', { error });
      res.status(500).json({ error: 'Failed to send check-in' });
    }
  });

  /**
   * Trigger emergency escalation manually
   */
  router.post('/emergency', async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber, tenantId, emergencyType, description, language } = req.body;

      if (!phoneNumber || !tenantId || !emergencyType || !description) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      await emergencyHandler.manualEscalation(
        phoneNumber,
        tenantId,
        emergencyType,
        description,
        language || 'en'
      );

      res.json({ success: true, message: 'Emergency escalation triggered' });
    } catch (error) {
      logger.error('Failed to trigger emergency', { error });
      res.status(500).json({ error: 'Failed to trigger emergency' });
    }
  });

  /**
   * Get session info
   */
  router.get('/session/:phoneNumber', async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber } = req.params;
      const session = await sessionStore.get(phoneNumber);

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.json({
        id: session.id,
        tenantId: session.tenantId,
        state: session.state,
        language: session.language,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      logger.error('Failed to get session', { error });
      res.status(500).json({ error: 'Failed to get session' });
    }
  });

  /**
   * Clear session
   */
  router.delete('/session/:phoneNumber', async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber } = req.params;
      await sessionStore.delete(phoneNumber);
      res.json({ success: true, message: 'Session cleared' });
    } catch (error) {
      logger.error('Failed to clear session', { error });
      res.status(500).json({ error: 'Failed to clear session' });
    }
  });

  // ============================================================================
  // Set Status Handler
  // ============================================================================

  /**
   * Set custom message status handler
   */
  (router as Router & { setStatusHandler: (handler: MessageStatusHandler) => void }).setStatusHandler = (handler: MessageStatusHandler): void => {
    statusHandler = handler;
  };

  return router;
}

// ============================================================================
// Raw Body Middleware (for signature validation)
// ============================================================================

export function rawBodyMiddleware(
  req: Request & { rawBody?: string },
  res: Response,
  next: NextFunction
): void {
  let data = '';
  
  req.setEncoding('utf8');
  
  req.on('data', (chunk: string) => {
    data += chunk;
  });
  
  req.on('end', () => {
    req.rawBody = data;
    try {
      req.body = JSON.parse(data);
    } catch {
      req.body = {};
    }
    next();
  });
}
