var webpack = require('webpack');
var path = require('path');
var _ = require('underscore');
module.exports = {
  devtool: 'eval',
  entry: [
    path.resolve(__dirname, 'assets/javascripts/application.jsx')
  ],
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: 'bundle.js',
  },
  resolve: {
    root: [path.resolve(__dirname)],
    extensions: ['', '.js', '.jsx']
  },
  resolveLoader: {
    root: path.join(__dirname, 'node_modules')
  },
  module: {
    loaders: [
      {
        test: /\.sass$/,
        loaders: ['style', 'css', 'sass'],
        include: path.resolve(__dirname, 'assets/stylesheets')
      },
      {
        test: /\.css$/,
        loader: "style-loader!css-loader"
      },
      {
        test: /\.(eot|woff|woff2|ttf|svg|png|jpe?g|gif)(\?\S*)?$/,
        loader: 'url?limit=100000@name=[name][ext]'
      },
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        query: {
          presets: ['es2015', 'react']
        }
      }
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      _: 'underscore',
      React: 'react',
      ReactDOM: 'react-dom',
      update: 'react-addons-update',
      socketIO: 'socket.io-client',
      // m: 'matter-js',
      m: path.resolve(__dirname, 'shared/matter-edge-build.js')
    })
  ]
};
