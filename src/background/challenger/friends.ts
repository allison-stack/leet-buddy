export function canonicalPair(x: string, y: string): { user_a: string; user_b: string } {
  return x < y ? { user_a: x, user_b: y } : { user_a: y, user_b: x };
}
