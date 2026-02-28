import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  useColorScheme, 
  Dimensions,
  Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { themes } from '../../constants/themes';

const { width } = Dimensions.get('window');

const ServerError = ({ onRetry, errorMessage }) => {
  const colorScheme = useColorScheme();
  const theme = themes[colorScheme] ?? themes.light;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.iconContainer, { backgroundColor: theme.card }]}>
        <MaterialCommunityIcons name="server-off" size={80} color="#ef4444" />
      </View>

      <Text style={[styles.title, { color: theme.text }]}>Server Error</Text>
      
      <Text style={[styles.subtitle, { color: theme.subText }]}>
        {errorMessage || "Our database is currently busy or unavailable. Please try again in a moment."}
      </Text>

      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={onRetry}
        style={[styles.retryBtn, { backgroundColor: theme.primary }]}
      >
        <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
        <Text style={styles.retryText}>Try Again</Text>
      </TouchableOpacity>

      {Platform.OS === 'web' && (
        <Text style={[styles.footerText, { color: theme.subText }]}>
          Error Code: 500 | Firebase Service Interruption
        </Text>
      )}
    </View>
  );
};

export default ServerError;

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 30 
  },
  iconContainer: {
    padding: 30,
    borderRadius: 40,
    marginBottom: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  title: { 
    fontSize: 26, 
    fontWeight: '900', 
    marginBottom: 10,
    textAlign: 'center'
  },
  subtitle: { 
    fontSize: 15, 
    textAlign: 'center', 
    lineHeight: 22, 
    marginBottom: 40,
    paddingHorizontal: 20
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 35,
    paddingVertical: 15,
    borderRadius: 15,
    gap: 10,
    elevation: 5,
  },
  retryText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '700' 
  },
  footerText: {
    position: 'absolute',
    bottom: 30,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1
  }
});