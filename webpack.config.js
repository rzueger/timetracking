const path = require('path');
const webpackNodeExternals = require('webpack-node-externals');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  target: 'node',
  entry: {
    setup: './setup.js',
    push: './push-jira.js',
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
