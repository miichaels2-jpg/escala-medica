import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";

export default [
  // 1. Pastas ignoradas globalmente
  {
    ignores: ["src/components/ui/**/*", "dist/**/*", "node_modules/**/*"],
  },

  // Scripts de apoio (gravação dos tutoriais) rodam no Node.
  {
    files: ["scripts/**/*.{js,mjs,cjs}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser }, sourceType: "module", ecmaVersion: 2022 },
  },

  // Arquivos de configuração e testes rodam no Node.
  {
    files: ["*.config.js", "tests/**/*.js"],
    languageOptions: { globals: { ...globals.node } },
  },

  // Service worker (avisos no celular e cache): roda fora da página.
  {
    files: ["public/sw.js"],
    languageOptions: { globals: { ...globals.serviceworker } },
  },

  // 2. Configurações recomendadas base
  pluginJs.configs.recommended,
  pluginReact.configs.flat.recommended,

  // 3. Regras e escopo do projeto
  {
    files: [
      "src/**/*.{js,mjs,cjs,jsx}", // Cobre App.jsx, main.jsx, Layout.jsx, pages e components
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "unused-imports": pluginUnusedImports,
    },
    rules: {
      "no-unused-vars": "off",
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "off", // Desnecessário no React 17+
      "react/react-in-jsx-scope": "off", // Permite JSX sem importar React explicitamente
      "react/prop-types": "off",
      // catch vazio é de propósito: armazenamento do navegador bloqueado ou falha que não deve parar a tela.
      "no-empty": ["error", { allowEmptyCatch: true }],
      // Ícones do lucide com o mesmo nome de algo do navegador: esquecer o import passa no Chrome
      // (que tem o nome) e quebra no Safari (V0.7.6: Relatórios e Faturamento com "Presentation").
      "no-restricted-globals": ["error", ...["Bluetooth", "Clipboard", "Fence", "File", "Gamepad", "History", "Image", "Keyboard", "Lock", "Navigation", "Option", "Presentation", "Text"]
        .map(name => ({ name, message: `Importe ${name} (ícone do lucide-react) ou use window.${name}: sem import funciona no Chrome e quebra no Safari.` }))],
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "react/no-unknown-property": [
        "error",
        { ignore: ["cmdk-input-wrapper", "toast-close"] },
      ],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];