import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/**",
    // Compiled JS output — never lint build artifacts.
    "**/dist/**",
    // Separate NestJS service with its own toolchain/config.
    "backend/**",
    // One-off codemods / scratch scripts.
    "*.local.js",
    "fix*.js",
  ]),
]);

export default eslintConfig;
