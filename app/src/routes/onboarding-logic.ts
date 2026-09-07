export function needsGithubLink(session: any): boolean {
  const providers = (session?.user?.identities ?? []).map(
    (i: any) => i.provider
  );
  return !providers.includes("github");
}
