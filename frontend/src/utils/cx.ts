/** Join class names, skipping falsy values: cx("a", ok && "b"). */
export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}
