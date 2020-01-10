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
