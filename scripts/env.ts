/** Reads a required setting from .env.local, with a clear message when it's missing. Never prints the value. */
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}. Add it to .env.local (see .env.example).`);
    process.exit(1);
  }
  return value;
}

export function heading(text: string): void {
  console.log(`\n\x1b[1m${text}\x1b[0m`);
}
