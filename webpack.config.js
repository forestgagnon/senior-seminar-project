var webpack = require('webpack');
var path = require('path');
var _ = require('underscore');
module.exports = {
  devtool: 'eval',
  entry: [
    'webpack-dev-server/client?http://localhost:8080',
    'webpack/hot/only-dev-server',
    path.resolve(__dirname, 'assets/javascripts/application.jsx')
  ],
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: 'bundle.js',
    publicPath: 'http://localhost:8080/public/',
  },
  resolve: {
    root: [path.resolve(__dirname, 'assets/javascripts')],
    extensions: ['', '.js', '.jsx']
  },
  resolveLoader: {
    root: path.join(__dirname, 'node_modules')
  },
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        loader: 'react-hot',
        exclude: /node_modules/,
        include: [
          path.resolve(__dirname, 'assets/javascripts/components'),
          path.resolve(__dirname, 'assets/javascripts/constants')
        ]
      },
      {
        test: /\.sass$/,
        loaders: ['style', 'css', 'sass'],
        include: path.resolve(__dirname, 'assets/stylesheets')
      },
      {
        test: /\.css$/,
        loader: "style-loader!css-loader"
      },{
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
      Redux: 'redux',
      update: 'react-addons-update'
    }),
    new webpack.HotModuleReplacementPlugin()
  ],
  scripts: {
    start: 'node webpack-dev-server.js'
  }
};
