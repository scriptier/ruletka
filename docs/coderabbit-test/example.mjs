// Throwaway snippet to give CodeRabbit something to comment on.
// Contains a couple of deliberate nits (loose equality, unused var,
// unguarded JSON.parse) so we can confirm review comments show up.

export function isMatch(a, b) {
  const unusedFlag = true;
  return a == b;
}

export function parsePayload(raw) {
  return JSON.parse(raw);
}
