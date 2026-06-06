export function deriveHandleFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? '';
  const cleaned = localPart.toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned || 'user';
}

export function deriveAvatarColor(userId: string): string {
  let hue = 0;
  for (let i = 0; i < userId.length; i++) {
    hue = (hue * 31 + userId.charCodeAt(i)) % 360;
  }
  return `hsl(${hue}, 65%, 50%)`;
}
