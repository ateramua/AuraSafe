import { VaultService, type VaultStorageAdapter } from '@aurasafe/core';

export interface BiometricAuthProvider {
  isAvailable(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
  enable(): Promise<boolean>;
  disable(): Promise<boolean>;
  unlock(): Promise<boolean>;
}

export class AuthCoordinator {
  private readonly vault: VaultService;

  constructor(storage: VaultStorageAdapter, private readonly biometric?: BiometricAuthProvider) {
    this.vault = new VaultService(storage);
  }

  getVaultService(): VaultService {
    return this.vault;
  }

  async isInitialized(): Promise<boolean> {
    return this.vault.isInitialized();
  }

  isUnlocked(): boolean {
    return this.vault.isUnlocked();
  }

  async createVault(masterPassword: string): Promise<void> {
    if (masterPassword.length < 8) throw new Error('Master password must be at least 8 characters');
    await this.vault.initVault(masterPassword);
  }

  async unlock(masterPassword: string): Promise<boolean> {
    return this.vault.unlockVault(masterPassword);
  }

  lock(): void {
    this.vault.lockVault();
  }

  async unlockWithBiometric(): Promise<boolean> {
    if (!this.biometric) return false;
    const ok = await this.biometric.unlock();
    return ok;
  }

  async biometricStatus(): Promise<{ available: boolean; enabled: boolean }> {
    if (!this.biometric) return { available: false, enabled: false };
    return {
      available: await this.biometric.isAvailable(),
      enabled: await this.biometric.isEnabled(),
    };
  }

  async enableBiometric(): Promise<boolean> {
    if (!this.biometric || !this.vault.isUnlocked()) return false;
    return this.biometric.enable();
  }

  async disableBiometric(): Promise<boolean> {
    if (!this.biometric) return false;
    return this.biometric.disable();
  }
}
