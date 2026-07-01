// `ejs` ships without bundled types and @types/ejs isn't installed.
// Minimal ambient declaration so `import ejs from "ejs"` type-checks on build.
// For full typings instead, run: npm i -D @types/ejs
declare module "ejs" {
  export function renderFile(
    path: string,
    data?: Record<string, unknown>,
  ): Promise<string>;
  const ejs: { renderFile: typeof renderFile };
  export default ejs;
}
