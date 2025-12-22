const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 웹 빌드 파일들을 asset으로 인식하도록 확장자 추가
config.resolver.assetExts.push(
  'html',
  'css',
  'js',
  'map'
);

module.exports = config;
