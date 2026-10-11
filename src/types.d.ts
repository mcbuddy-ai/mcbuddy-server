// Bun inlines text imports at build time, so prompts ship inside the bundle.
declare module "*.md" {
  const text: string;
  export default text;
}
