export type ProviderTestResult = "success" | "invalid-key" | "network-error";

export async function testProviderKey(key: string): Promise<ProviderTestResult> {
  await new Promise((resolve) => setTimeout(resolve, 10));
  const trimmed = key.trim();
  if (trimmed.length === 0) {
    return "invalid-key";
  }
  if (trimmed.length < 8) {
    return "invalid-key";
  }
  return "success";
}
