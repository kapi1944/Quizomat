import jezykJavaScript from '@eslint/js';
import zmienneGlobalne from 'globals';
import jezykTypeScript from 'typescript-eslint';
import hakiReacta from 'eslint-plugin-react-hooks';
import odswiezanieReacta from 'eslint-plugin-react-refresh';

export default jezykTypeScript.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  jezykJavaScript.configs.recommended,
  ...jezykTypeScript.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...zmienneGlobalne.browser, ...zmienneGlobalne.node },
    },
    plugins: {
      'react-hooks': hakiReacta,
      'react-refresh': odswiezanieReacta,
    },
    rules: {
      ...hakiReacta.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
);
