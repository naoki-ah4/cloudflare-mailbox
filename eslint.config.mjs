import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
    eslint.configs.recommended,
    tseslint.config(
        tseslint.configs.recommendedTypeChecked,
        {
            languageOptions: {
                parserOptions: {
                    projectService: true,
                    tsconfigRootDir: import.meta.dirname,
                },
            },
        }
    ),
    {
        rules: {
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/require-await": "off",
        }
    }
    ,
    globalIgnores(["./*.*", ".react-router"])
]
)