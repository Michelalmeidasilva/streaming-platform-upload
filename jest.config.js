/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: { module: 'commonjs', jsx: 'react-jsx' } }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.css$': 'identity-obj-proxy',
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageThreshold: {
    './src/**/*.{ts,tsx}': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
