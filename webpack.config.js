const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  target: 'node',
  entry: {
    setup: './setup.js',
    push: './push-jira.js',
  },
  optimization: {
    usedExports: true,
    sideEffects: true,
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    libraryTarget: 'commonjs2'
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'assets', to: '' }
      ],
    }),
  ],
};
