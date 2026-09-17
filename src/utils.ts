export function isNoColorEnabled(noColorFlag: boolean): boolean {
  if (noColorFlag) return true;
  if (process.env.NO_COLOR !== undefined) return true;
  return false;
}

export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}
