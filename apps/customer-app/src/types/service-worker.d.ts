/**
 * TypeScript declarations for Service Worker and PWA APIs
 */

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface ServiceWorkerRegistrationEventMap {
  updatefound: Event;
}

interface Navigator {
  serviceWorker?: ServiceWorkerContainer;
  getInstalledRelatedApps?: () => Promise<unknown[]>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
  appinstalled: Event;
}

interface PushSubscriptionOptions {
  userVisibleOnly?: boolean;
  applicationServerKey?: BufferSource | string | null;
}

interface PushManager {
  subscribe(options?: PushSubscriptionOptions): Promise<PushSubscription>;
  getSubscription(): Promise<PushSubscription | null>;
  permissionState(options?: PushSubscriptionOptions): Promise<PermissionState>;
}

interface PushSubscription {
  endpoint: string;
  expirationTime: number | null;
  getKey(name: 'p256dh'): ArrayBuffer | null;
  getKey(name: 'auth'): ArrayBuffer | null;
  toJSON(): PushSubscriptionJSON;
  unsubscribe(): Promise<boolean>;
}

interface PushSubscriptionJSON {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

interface SyncManager {
  getTags(): Promise<string[]>;
  register(tag: string): Promise<void>;
}

interface ServiceWorkerRegistration {
  readonly sync?: SyncManager;
  readonly pushManager?: PushManager;
  showNotification(title: string, options?: NotificationOptions): Promise<void>;
}

interface ServiceWorkerContainer {
  readonly controller: ServiceWorker | null;
  readonly ready: Promise<ServiceWorkerRegistration>;
  register(scriptURL: string, options?: RegistrationOptions): Promise<ServiceWorkerRegistration>;
  getRegistration(scope?: string): Promise<ServiceWorkerRegistration | undefined>;
  getRegistrations(): Promise<ServiceWorkerRegistration[]>;
  startMessages(): void;
  addEventListener<K extends keyof ServiceWorkerContainerEventMap>(
    type: K,
    listener: (ev: ServiceWorkerContainerEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
}

interface ServiceWorkerContainerEventMap {
  controllerchange: Event;
  message: MessageEvent;
}

interface ExtendableEvent extends ExtendableEventInit {
  waitUntil(promise: Promise<unknown>): void;
}

interface FetchEvent extends ExtendableEvent {
  readonly request: Request;
  readonly clientId: string;
  readonly resultingClientId: string;
  readonly handled: Promise<undefined>;
  respondWith(response: Response | Promise<Response>): void;
}

interface InstallEvent extends ExtendableEvent {
  readonly activeWorker: ServiceWorker | null;
}

interface ActivateEvent extends ExtendableEvent {}

interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
  readonly lastChance: boolean;
}

interface PushEvent extends ExtendableEvent {
  readonly data: PushMessageData | null;
}

interface PushMessageData {
  arrayBuffer(): ArrayBuffer;
  blob(): Blob;
  json(): unknown;
  text(): string;
}

interface NotificationEvent extends ExtendableEvent {
  readonly action: string;
  readonly notification: Notification;
}

declare const self: ServiceWorkerGlobalScope;

interface ServiceWorkerGlobalScope {
  readonly caches: CacheStorage;
  readonly clients: Clients;
  readonly registration: ServiceWorkerRegistration;
  skipWaiting(): Promise<void>;
  addEventListener(type: 'install', listener: (ev: InstallEvent) => void): void;
  addEventListener(type: 'activate', listener: (ev: ActivateEvent) => void): void;
  addEventListener(type: 'fetch', listener: (ev: FetchEvent) => void): void;
  addEventListener(type: 'sync', listener: (ev: SyncEvent) => void): void;
  addEventListener(type: 'push', listener: (ev: PushEvent) => void): void;
  addEventListener(type: 'message', listener: (ev: MessageEvent) => void): void;
  addEventListener(type: 'notificationclick', listener: (ev: NotificationEvent) => void): void;
}

/** WindowClient.navigate() - opens URL in controlled client */
interface WindowClient {
  navigate?(url: string): Promise<WindowClient | null>;
}
