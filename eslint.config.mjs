import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

for (const conf of nextVitals) {
  if (conf.rules) {
    for (const key of Object.keys(conf.rules)) {
      if (key.includes('set-state-in-effect')) {
        conf.rules[key] = "warn";
      }
      if (key === 'prefer-const') {
        conf.rules[key] = "warn";
      }
      if (key.includes('no-img-element')) {
        conf.rules[key] = "warn";
      }
      if (key.includes('no-unescaped-entities')) {
        conf.rules[key] = "warn";
      }
    }
    if (conf.plugins && conf.plugins['react-hooks']) {
      conf.rules["react-hooks/set-state-in-effect"] = "warn";
    }
    if (conf.plugins && conf.plugins['react']) {
      conf.rules["react/no-unescaped-entities"] = "warn";
    }
    conf.rules["prefer-const"] = "warn";
  }
}

for (const conf of nextTs) {
  if (conf.rules) {
    conf.rules["@typescript-eslint/no-explicit-any"] = "off";
    conf.rules["@typescript-eslint/no-require-imports"] = "off";
    conf.rules["@typescript-eslint/no-unused-vars"] = "warn";
    conf.rules["@typescript-eslint/no-empty-object-type"] = "off";
    conf.rules["prefer-const"] = "warn";
  }
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "prefer-const": "warn",
    }
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "tests/**",
    "scripts/**",
    "scratch/**",
    "backend/**",
    "frontend/**",
    "*.js",
    "*.mjs",
    "*.cjs",
    "**/*.js",
    "**/*.mjs",
    "**/*.cjs",
  ]),
]);

export default eslintConfig;
