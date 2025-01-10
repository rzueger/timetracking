const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const webpackNodeExternals = require('webpack-node-externals');

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
  externals: [webpackNodeExternals()],
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'assets', to: '' }
      ],
    }),
  ],
};
