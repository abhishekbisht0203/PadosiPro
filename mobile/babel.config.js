module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    // Reanimated 4 delegates worklet compilation to react-native-worklets.
    // babel-preset-expo wires this up automatically when the package is
    // installed, but naming it here keeps the requirement visible to anyone
    // reading babel.config.js for the first time.
    plugins: ['react-native-worklets/plugin'],
  };
};
