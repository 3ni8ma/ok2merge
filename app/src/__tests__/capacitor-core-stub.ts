// Test-only stub for @capacitor/core (see vitest.config.ts alias).
export function registerPlugin(_name: string) {
  return { writeSnapshot: async (_o: unknown) => {} };
}
export const Capacitor = {
  isNativePlatform: () => false,
  getPlatform: () => "web",
};
