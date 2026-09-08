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

// Dormant until the App Store return: Apple sign-in is only required for
// store distribution. Free-first uses GitHub-only auth (see Onboarding).
export async function appleSignIn(serviceId: string) {
  if (Capacitor.getPlatform() !== "ios")
    await AppleSignIn.initialize({ clientId: serviceId });
  return AppleSignIn.signIn({ scopes: [SignInScope.Email] });
}

export async function confirmHuman(reason: string): Promise<boolean> {
  if (isNative()) {
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
  return confirmHumanWeb();
}

// PWA fallback: platform authenticator (Face ID / Touch ID / Windows Hello
// via WebAuthn). First approval registers a local passkey; later approvals
// assert against it. Returns false where WebAuthn is unavailable — callers
// must treat that as "cannot approve on this browser".
async function confirmHumanWeb(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    const stored = localStorage.getItem("ok2merge-credential-id");
    if (!stored) {
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: "OK2Merge", id: window.location.hostname },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: "reviewer",
            displayName: "Reviewer",
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          attestation: "none",
        },
      })) as PublicKeyCredential | null;
      if (!cred) return false;
      localStorage.setItem(
        "ok2merge-credential-id",
        btoa(String.fromCharCode(...new Uint8Array(cred.rawId)))
      );
      return true;
    }
    const rawId = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: rawId.buffer as ArrayBuffer }],
        userVerification: "required",
      },
    });
    return assertion !== null;
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
