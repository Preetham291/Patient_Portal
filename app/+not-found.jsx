import React, { useEffect } from 'react';
import { View, Text, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { themes } from '../constants/themes';

export default function NotFoundScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = themes[colorScheme] ?? themes.light;

  useEffect(() => {
    const timer = setTimeout(() => {
      handleGoHome();
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const handleGoHome = () => {
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace('/');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Ionicons name="alert-circle-outline" size={80} color={theme.primary} />
      
      <Text style={[styles.title, { color: theme.text }]}>Lost your way?</Text>
      
      <Text style={[styles.subtitle, { color: theme.subText }]}>
        We couldn't find the page you're looking for.
      </Text>

      <View style={styles.redirectBox}>
        <ActivityIndicator size="small" color={theme.primary} style={{ marginBottom: 15 }} />
        <Text style={[styles.redirectText, { color: theme.text }]}>
          Redirecting to a safe spot...
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 30 
  },
  title: { 
    fontSize: 26, 
    fontWeight: '900', 
    marginTop: 20 
  },
  subtitle: { 
    fontSize: 15, 
    textAlign: 'center', 
    marginTop: 10, 
    lineHeight: 22,
    opacity: 0.8 
  },
  redirectBox: { 
    marginTop: 40, 
    alignItems: 'center',
    width: '100%'
  },
  redirectText: { 
    fontSize: 13, 
    fontWeight: '600',
    textAlign: 'center'
  }
});