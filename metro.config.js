const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Only watch the files we care about, not the entire home directory
config.watchFolders = [__dirname];
config.resolver.blockList = [
  /\/Library\/.*/,
  /\/\.Trash\/.*/,
  /\/Pictures\/.*/,
  /\/Movies\/.*/,
  /\/Music\/.*/,
  /\/Applications\/.*/,
  /\/Downloads\/.*/,
  /\/Documents\/(?!GitHub\/ZTK\/).*/,
  /\/Desktop\/.*/,
  /\/foundry-f23\/.*/,
  /\/foundry-smart-contract-lottery-f23\/.*/,
  /\/budget-app\/.*/,
  /\/CascadeProjects\/.*/,
  /\/payment-intent-mvp\/.*/,
  /\/personal_finance_os\/.*/,
  /\/s-scan-mvp\/.*/,
  /\/treasury-dashboard\/.*/,
  /\/triathlon-marathon-website\/.*/,
  /\/NetBeansProjects\/.*/,
  /\/Sites\/.*/,
];

module.exports = config;
