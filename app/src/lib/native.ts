import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { PushNotifications } from "@capacitor/push-notifications";
import {
  AppleSignIn,
  SignInScope,
} from "@capawesome/capacitor-apple-sign-in";
import {
  BiometricAuth,
  AndroidBiometryStrength,
} from "@aparajita/capacitor-biometric-auth";
import { Purchases } from "@revenuecat/purchases-capacitor";
import { Capacitor } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();
export const buzz = () => Haptics.impact({ style: ImpactStyle.Medium });

export async function appleSignIn(serviceId: string) {
  if (Capacitor.getPlatform() !== "ios")
    await AppleSignIn.initialize({ clientId: serviceId });
  return AppleSignIn.signIn({ scopes: [SignInScope.Email] });
}

export async function confirmHuman(reason: string): Promise<boolean> {
  try {
    await BiometricAuth.authenticate({
      reason,
      allowDeviceCredential: true,
      androidTitle: "Confirm review",
      androidBiometryStrength: AndroidBiometryStrength.weak,
    });
    return true;
  } catch {
    return false;
  }
}

export async function registerPush(): Promise<{
  token: string;
  platform: "ios" | "android";
} | null> {
  if (!isNative()) return null;
  const permit = await PushNotifications.requestPermissions();
  if (permit.receive === "denied") return null;
  const done = new Promise<string>((res) =>
    PushNotifications.addListener("registration", ({ value }) => res(value))
  );
  await PushNotifications.register();
  return {
    token: await done,
    platform: Capacitor.getPlatform() as "ios" | "android",
  };
}

export const PRO_LIVE = import.meta.env.VITE_PRO_LIVE === "true"; // false until 1.0

export async function proActive(): Promise<boolean> {
  if (!PRO_LIVE || !isNative()) return true; // beta: everything open
  const info = await Purchases.getCustomerInfo();
  return info.customerInfo.entitlements.active["pro"] !== undefined;
}
