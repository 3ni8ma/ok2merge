import { useEffect, useState } from "react";
import { Purchases } from "@revenuecat/purchases-capacitor";

import { PRO_LIVE, isNative } from "../lib/native";
import { C } from "../theme";

export default function Paywall() {
  const [offerings, setOfferings] = useState<string[]>([]);

  useEffect(() => {
    if (!PRO_LIVE || !isNative()) return;
    Purchases.getOfferings().then((o) =>
      setOfferings(
        (o.current?.availablePackages ?? []).map((p) => p.identifier)
      )
    );
  }, []);

  async function buy(pkgId: string) {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find(
      (p) => p.identifier === pkgId
    );
    if (pkg) await Purchases.purchasePackage({ aPackage: pkg });
  }

  return (
    <div style={{ background: C.ink, color: C.paper, minHeight: "100dvh", padding: 16 }}>
      <h2>OK2Merge Pro</h2>
      {!PRO_LIVE && <p>Pro coming at 1.0 — everything is free during beta.</p>}
      {PRO_LIVE &&
        offerings.map((id) => (
          <button key={id} onClick={() => buy(id)}>
            Buy {id}
          </button>
        ))}
    </div>
  );
}
