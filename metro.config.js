const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Register video formats as static assets so Metro doesn't try to parse them as JS
config.resolver.assetExts.push('mov', 'mp4', 'webm', 'avi', 'mkv');

module.exports = config;
