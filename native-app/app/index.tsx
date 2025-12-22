import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { WEB_HTML_CONTENT } from '../src/webContent';

export default function GameScreen() {
  // HTML 콘텐츠가 없는 경우 (빌드 전)
  if (!WEB_HTML_CONTENT) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>웹 콘텐츠 없음</Text>
        <Text style={styles.errorText}>
          먼저 웹 프로젝트를 빌드하고 copy-web 스크립트를 실행하세요.
        </Text>
        <Text style={styles.codeText}>
          {`cd .. && npm run build:native\ncd native-app && npm run copy-web`}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{ html: WEB_HTML_CONTENT, baseUrl: '' }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState={true}
        scalesPageToFit={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4a90e2" />
            <Text style={styles.loadingText}>게임 로딩 중...</Text>
          </View>
        )}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView 오류:', nativeEvent);
        }}
        onMessage={(event) => {
          // 웹에서 React Native로 메시지 수신
          console.log('웹에서 메시지:', event.nativeEvent.data);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ffffff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ff6b6b',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  codeText: {
    fontSize: 12,
    color: '#4ecdc4',
    fontFamily: 'monospace',
    backgroundColor: '#2a2a4e',
    padding: 15,
    borderRadius: 8,
    textAlign: 'center',
  },
});
