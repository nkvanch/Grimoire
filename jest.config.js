// jest.config.js
// Standard Expo SDK 56 Jest setup (jest-expo preset handles RN/Expo module
// transforms automatically). Engine tests (src/engine/**) are pure
// TypeScript with no React Native imports, so they run fast under this same
// config without needing a separate runner.
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  // release/ is git-ignored local build output; tests left in it are not part of the suite
  // .claude/ holds agent working copies of this repo; their files are not part of this suite either
  // the parity scenario modules sit beside the tests that use them; they hold data and executors, not tests
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/release/', '<rootDir>/.claude/', '/src/engine/__tests__/parity[A-Za-z]*Scenarios\\.ts$'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  collectCoverageFrom: [
    'src/engine/**/*.ts',
    '!src/engine/**/*.d.ts',
  ],
};
