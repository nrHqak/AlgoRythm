import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

const sourceFiles = ["**/*.{js,jsx}"];

export default [
  {
    ignores: ["coverage", "dist", "node_modules"],
  },
  {
    ...js.configs.recommended,
    files: sourceFiles,
  },
  {
    ...reactHooks.configs.flat.recommended,
    files: sourceFiles,
  },
  {
    ...reactRefresh.configs.vite,
    files: ["src/App.jsx", "src/components/**/*.jsx", "src/pages/**/*.jsx"],
  },
  {
    files: sourceFiles,
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Compiler-oriented rules are introduced as non-blocking follow-up work;
      // the baseline keeps core Rules of Hooks and dependency analysis active.
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
];
