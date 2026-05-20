import * as LocalAuthentication from 'expo-local-authentication';
import type { BiometricAuthProvider } from '@aurasafe/auth';

const BIOMETRIC_FLAG = 'aurasafe.biometric.enabled';

export class AndroidBiometricProvider implements BiometricAuthProvider {
  async isAvailable(): Promise<boolean> {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  }

  async isEnabled(): Promise<boolean> {
    const { default: SecureStore } = await import('expo-secure-store');
    return (await SecureStore.getItemAsync(BIOMETRIC_FLAG)) === 'true';
  }

  async enable(): Promise<boolean> {
    if (!(await this.isAvailable())) return false;
    const { default: SecureStore } = await import('expo-secure-store');
    await SecureStore.setItemAsync(BIOMETRIC_FLAG, 'true');
    return true;
  }

  async disable(): Promise<boolean> {
    const { default: SecureStore } = await import('expo-secure-store');
    await SecureStore.deleteItemAsync(BIOMETRIC_FLAG);
    return true;
  }

  async unlock(): Promise<boolean> {
    if (!(await this.isEnabled())) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock AuraSafe',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  }
}
