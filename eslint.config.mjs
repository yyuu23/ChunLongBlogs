import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import importX from "eslint-plugin-import-x";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    plugins: {
      "import-x": importX,
    },
    linterOptions: {
      // 历史代码里有针对可选规则的局部说明；关闭某规则时不把说明本身变成 CI 噪音。
      reportUnusedDisableDirectives: "off",
    },
    settings: {
      "import-x/resolver": {
        typescript: true,
        node: true,
      },
    },
    rules: {
      "import-x/no-cycle": ["error", { ignoreExternal: true, maxDepth: 12 }],
      // React 19 编译器型规则会把大量合法的浏览器状态同步模式判为错误。
      // 保留 rules-of-hooks；这些规则等启用 React Compiler 时再逐模块迁移。
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/exhaustive-deps": "off",
      // 站点大量图片支持用户直链/动图，统一 Image 优化会改变现有语义。
      "@next/next/no-img-element": "off",
    },
  },
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/*", "@/app/**", "@/components/*", "@/components/**"],
              message: "src/lib must not depend on app routes or UI components; move the shared contract into src/lib.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/admin/*", "@/lib/admin/**",
                "@/lib/ai/*", "@/lib/ai/**",
                "@/lib/analytics/*", "@/lib/analytics/**",
                "@/lib/auth/*", "@/lib/auth/**",
                "@/lib/bottles/*", "@/lib/bottles/**",
                "@/lib/chat/*", "@/lib/chat/**",
                "@/lib/content/*", "@/lib/content/**",
                "@/lib/engagement/*", "@/lib/engagement/**",
                "@/lib/lab/*", "@/lib/lab/**",
                "@/lib/music/*", "@/lib/music/**",
                "@/lib/public-write/*", "@/lib/public-write/**",
                "@/lib/seasonal/*", "@/lib/seasonal/**",
                "@/lib/site/*", "@/lib/site/**",
                "@/lib/db", "@/lib/db/*", "@/lib/db/**",
              ],
              message: "src/lib/shared is foundational and must not depend on business domains or database code.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "coverage/**", "out/**", "build/**", "public/**"]),
]);
