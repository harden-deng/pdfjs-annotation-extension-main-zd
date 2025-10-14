/* eslint-disable import/no-extraneous-dependencies */
const { merge } = require('webpack-merge');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');

const webpackConfiguration = require('../webpack.config');

module.exports = merge(webpackConfiguration, {
  mode: 'production',

  /* Disable source maps for production */
  devtool: false,

  /* Optimization configuration */
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        parallel: true, // Enable multi-process parallel running
        terserOptions: {
          compress: {
            drop_console: true,     // 移除所有 console.* 调用
            drop_debugger: true,    // 移除所有 debugger 语句
            pure_funcs: ['console.log', 'console.info', 'console.debug'] // 额外确保这些被移除
          },
          format: {
            comments: false, // Remove all comments from the output
          },
        },
        extractComments: false, // Ensure no separate license files are generated
      }),
      new CssMinimizerPlugin(),
    ],
  },

  /* Performance thresholds configuration */
  performance: {
    hints: false, // Disable performance hints
    maxEntrypointSize: 1024000, // Set a higher limit to avoid warnings (1 MB)
    maxAssetSize: 1024000, // Set a higher limit to avoid warnings (1 MB)
  },

  /* Additional plugins configuration */
  plugins: [
    // Use the BannerPlugin to ensure no license comments are included in the output
    new webpack.BannerPlugin({
      banner: '', // Insert an empty banner
      raw: true, // Insert the banner as a raw string
    }),
  ],
});
