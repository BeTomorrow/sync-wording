function concat<K, V>(first: Map<K, V>, other: Map<K, V>): Map<K, V> {
  const result = new Map<K, V>();
  first.forEach((v, k) => {
    result.set(k, v);
  });
  other.forEach((v, k) => {
    result.set(k, v);
  });
  return result;
}

export function parseWordingLines(
  args: string[],
  languageCount: number,
  command: string = "--add"
): { key: string; values: string[] }[] {
  const lineSize = 1 + languageCount;
  if (args.length % lineSize !== 0) {
    throw new Error(
      `Invalid ${command} arguments: expected groups of ${lineSize} (key + ${languageCount} translation(s)), got ${args.length} value(s)`
    );
  }

  const lines: { key: string; values: string[] }[] = [];
  for (let i = 0; i < args.length; i += lineSize) {
    lines.push({ key: args[i], values: args.slice(i + 1, i + lineSize) });
  }
  return lines;
}
