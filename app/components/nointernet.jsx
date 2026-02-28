import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { themes } from '../../constants/themes'; 

const NoInternet = ({ checkConnection }) => {
  const colorScheme = useColorScheme();
  const theme = themes[colorScheme] ?? themes.light;

  return (
    <View style={[styles.centerContainer, { backgroundColor: theme.background, paddingHorizontal: 40 }]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.card }]}>
        <Ionicons name="wifi-outline" size={50} color={theme.primary} />
      </View>
      
      <Text style={[styles.title, { color: theme.text }]}>No Internet Connection</Text>
      
      <Text style={[styles.bodyText, { color: theme.subText }]}>
        You need an active connection to access the Manager Database. Please check your settings.
      </Text>
      
      <TouchableOpacity 
        style={[styles.retryBtn, { backgroundColor: theme.primary, borderColor: theme.primary }]} 
        onPress={checkConnection}
      >
        <Text style={styles.retryText}>Retry Connection</Text>
        <Ionicons name="refresh-outline" size={20} color="#fff" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    ...Platform.select({ web: { minHeight: '100vh' } })
  },
  iconCircle: {
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    textAlign: 'center' 
  },
  bodyText: { 
    textAlign: 'center', 
    marginTop: 10, 
    lineHeight: 20 
  },
  retryBtn: {
    flexDirection: 'row',
    marginTop: 30,
    width: Platform.OS === 'web' ? '60%' : '80%', 
    maxWidth: 300,
    padding: 15,
    alignItems: "center",
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
  },
  retryText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16 
  }
});

export default NoInternet;