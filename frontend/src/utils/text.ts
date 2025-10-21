export const stripCodeFence = (input: string | null | undefined) => {
  if (!input) {
    return "";
  }
  const trimmed = input.trim();
  const fenceMatch = trimmed.match(/^```[\w-]*\n([\s\S]*?)\n```$/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return trimmed;
};
