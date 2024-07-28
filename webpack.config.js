const path = require('path');

module.exports = {
    mode: 'development',  
    entry: './client/src/App.tsx',
    output: {
        path: path.resolve('./static'),
        filename: 'app.bundle.js'
    },
    devtool: 'inline-source-map',
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx|ts|tsx)$/,
                exclude: /node_modules/,
                use: ['babel-loader']
            }
        ]
    },
    plugins: [],
  };