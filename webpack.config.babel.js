import path from 'path';

import HtmlPlugin from 'html-webpack-plugin';
import WasmPackPlugin from '@wasm-tool/wasm-pack-plugin';
import webpack from 'webpack';

const NODE_MODULES = 'node_modules';

const PATH_DIST = './build';
const PATH_DIST_WASM = './build/wasm';
const PATH_SRC = './src';
const PATH_SRC_WASM = './wasm';

function getPath(filePath) {
  return path.resolve(__dirname, filePath);
}

export default () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const filename = isDevelopment ? '[name]' : '[name]-[contenthash:4]';
  const exclude = new RegExp(NODE_MODULES);

  return {
    mode: isDevelopment ? 'development' : 'production',
    entry: {
      app: getPath(`${PATH_SRC}/index.js`),
    },
    output: {
      filename: `${filename}.js`,
      sourceMapFilename: `${filename}.js.map`,
      path: getPath(PATH_DIST),
      publicPath: '/',
    },
    resolve: {
      modules: [NODE_MODULES],
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude,
          use: ['babel-loader', 'eslint-loader'],
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jp(e?)g|gif|woff(2?)|svg|ttf|eot)$/,
          exclude,
          use: [
            {
              loader: 'file-loader',
              options: {
                name: `[path]${filename}.[ext]`,
              },
            },
          ],
        },
      ],
    },
    devtool: 'source-map',
    devServer: {
      clientLogLevel: 'silent',
      liveReload: false,
    },
    optimization: {
      splitChunks: {
        cacheGroups: {
          commons: {
            test: new RegExp(NODE_MODULES),
            chunks: 'all',
            name: 'lib',
          },
        },
      },
    },
    plugins: [
      new HtmlPlugin({
        minify: isDevelopment
          ? false
          : {
              collapseWhitespace: true,
            },
        template: getPath(`${PATH_SRC}/index.html`),
      }),
      new WasmPackPlugin({
        crateDirectory: getPath(PATH_SRC_WASM),
        outDir: getPath(PATH_DIST_WASM),
      }),
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      }),
    ],
  };
};
