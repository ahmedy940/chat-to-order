import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Layer rules: Screens/Routes -> Use cases -> Domain. Adapters plug in through ports.
const OUTER = ["**/app/**", "**/ui/**", "**/server/**"];
const FRAMEWORKS = ["next", "next/**", "react", "react/**", "react-dom", "react-dom/**"];
const DRIVERS = ["better-sqlite3", "@google/genai", "@paypal/**"];

function layer(files, group, message, allowTypeImports = false) {
  return {
    files,
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group, message, allowTypeImports }] }],
    },
  };
}

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "data/**",
    ".agents/**",
    "agent/**",
    ".claude/**",
    "devpost/**",
    "next-env.d.ts",
  ]),

  // Clean-code limits from the spec: small files, small functions, simple branching.
  {
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.ts", "tests/**/*.ts"],
    rules: {
      "max-lines": ["error", { max: 250, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 30, skipBlankLines: true, skipComments: true }],
      complexity: ["error", 10],
      "max-depth": ["error", 3],
      "max-params": ["error", 4],
    },
  },
  { files: ["tests/**/*.ts"], rules: { "max-lines-per-function": "off" } },

  // Catch missing `await` and promises passed where they don't belong.
  {
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.ts", "tests/**/*.ts"],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
    },
  },

  layer(
    ["src/domain/**"],
    ["**/application/**", "**/infrastructure/**", ...OUTER, ...FRAMEWORKS, ...DRIVERS, "zod"],
    "The domain stays pure: no framework, storage, AI, payment or outer-layer imports.",
  ),
  layer(
    ["src/application/**"],
    ["**/infrastructure/**", ...OUTER, ...FRAMEWORKS, ...DRIVERS],
    "Use cases depend on ports, never on adapters, routes or screens.",
  ),
  layer(
    ["src/infrastructure/**"],
    [...OUTER, ...FRAMEWORKS],
    "Adapters implement ports; they don't reach into routes, screens or the container.",
  ),
  layer(
    ["src/app/**"],
    ["**/infrastructure/**", ...DRIVERS.filter((d) => d !== "@paypal/**")],
    "Routes and pages get use cases from @/server/container, never adapters or drivers directly.",
  ),
  layer(
    ["src/ui/**"],
    [
      "**/application/**",
      "**/infrastructure/**",
      "**/server/**",
      ...DRIVERS.filter((d) => d !== "@paypal/**"),
    ],
    "Screens talk to the server through the API routes; they may import types only.",
    true,
  ),
]);
