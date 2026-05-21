import type { BridgeSession } from '@aurasafe/types';

export const DESKTOP_BRIDGE_PROTOCOL_VERSION = 1;
export const BRIDGE_PORT_START = 36000;
export const BRIDGE_PORT_END = 36020;
export const BRIDGE_SCAN_TIMEOUT_MS = 1200;
export const BRIDGE_COMMAND_TIMEOUT_MS = 5000;

export const BridgeAction = {
  ping: 'ping',
  getVaultEntries: 'getVaultEntries',
  saveVaultEntry: 'saveVaultEntry',
  queueAutofill: 'queueAutofill',
  getPendingAutofill: 'getPendingAutofill',
  consumePendingAutofill: 'consumePendingAutofill',
  getTransactions: 'getTransactions',
  getAccounts: 'getAccounts',
  getCategories: 'getCategories',
  getUserSettings: 'getUserSettings',
  saveUserSetting: 'saveUserSetting',
} as const;

export type BridgeActionName = (typeof BridgeAction)[keyof typeof BridgeAction];

export function buildBridgeCommand(action: BridgeActionName, payload: Record<string, unknown> = {}) {
  return { ...payload, action, protocolVersion: DESKTOP_BRIDGE_PROTOCOL_VERSION };
}

export class DesktopBridgeClient {
  private session: BridgeSession | null = null;

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async discover(): Promise<number | null> {
    const ports = Array.from(
      { length: BRIDGE_PORT_END - BRIDGE_PORT_START + 1 },
      (_, i) => BRIDGE_PORT_START + i,
    );
    for (const port of ports) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), BRIDGE_SCAN_TIMEOUT_MS);
        const res = await this.fetchImpl(`http://127.0.0.1:${port}/bridge/health`, {
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) return port;
      } catch {
        /* try next port */
      }
    }
    return null;
  }

  async handshake(port: number): Promise<BridgeSession> {
    const res = await this.fetchImpl(`http://127.0.0.1:${port}/bridge/handshake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: 'aurasafe-mobile', protocolVersion: DESKTOP_BRIDGE_PROTOCOL_VERSION }),
    });
    if (!res.ok) throw new Error(`Handshake failed (${res.status})`);
    const body = (await res.json()) as { sessionToken: string; expiresAt: number };
    this.session = { sessionToken: body.sessionToken, expiresAt: body.expiresAt, port };
    return this.session;
  }

  async command<T>(action: BridgeActionName, payload: Record<string, unknown> = {}): Promise<T> {
    if (!this.session) throw new Error('Bridge session not established');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BRIDGE_COMMAND_TIMEOUT_MS);
    const res = await this.fetchImpl(`http://127.0.0.1:${this.session.port}/bridge/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.session.sessionToken}`,
      },
      body: JSON.stringify(buildBridgeCommand(action, payload)),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Bridge command failed (${res.status})`);
    const body = (await res.json()) as { ok: boolean; result?: T; error?: string };
    if (!body.ok) throw new Error(body.error || 'Bridge command error');
    return body.result as T;
  }
}
