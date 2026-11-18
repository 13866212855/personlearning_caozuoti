export function maskApiKey(apiKey: string): string {
  const trimmed = (apiKey || '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) {
    return '****';
  }
  const prefix = trimmed.slice(0, 5);
  const suffix = trimmed.slice(-3);
  return `${prefix}****${suffix}`;
}
