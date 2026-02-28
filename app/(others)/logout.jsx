import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, ActivityIndicator, Alert, Platform } from 'react-native';
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut } from 'firebase/auth';
import { useRouter } from 'expo-router'; 
import { auth } from '../../doctorauthentication/firebase'; 
import { themes } from '../../constants/themes'; 
import { Ionicons } from '@expo/vector-icons';

import Loading from "../components/loading"; 
import NoInternet from "../components/nointernet";

const Logout = () => {
  const router = useRouter(); 
  const colorScheme = useColorScheme();
  const theme = themes[colorScheme] ?? themes.light;
  
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(null);

  const checkweb = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      await fetch("https://8.8.8.8", { 
        mode: 'no-cors', 
        cache: 'no-store', 
        signal: controller.signal 
      });
      return true;
    } catch (error) {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const checkConnection = useCallback(async () => {
    const state = await NetInfo.fetch();
    let status = state.isConnected === true;
    if (status) status = await checkweb();
    setIsOnline(status);
    return status;
  }, []);

  useEffect(() => {
    checkConnection();
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      let online = state.isConnected === true;
      if (online) online = await checkweb();
      setIsOnline(online);
    });
    return () => unsubscribe();
  }, [checkConnection]);

  const handleSignOut = async () => {
    setLoading(true);
    
    const online = await checkConnection();
    if (!online) {
      setLoading(false);
      return;
    }

    try {
      await AsyncStorage.removeItem('patientSession');
      
      router.dismissAll(); 
      
      await signOut(auth);


    } catch (e) {
      console.error("Logout Error:", e);
      const msg = "Could not sign out securely. Please try again.";
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert("Error", msg);
      setLoading(false);
    }
  };

  if (isOnline === null) return <Loading />;
  if (isOnline === false) return <NoInternet checkConnection={checkConnection} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.card, { backgroundColor: theme.card, shadowColor: theme.text }]}>
        
        <View style={styles.iconContainer}>
          <Ionicons name="log-out-outline" size={50} color="#ef4444" />
        </View>

        <Text style={[styles.title, { color: theme.text }]}>End Session?</Text>
        
        <Text style={[styles.subtitle, { color: theme.subText }]}>
          You will need to re-authenticate to access the patient dashboard.
        </Text>

        <TouchableOpacity 
          style={styles.logoutBtn} 
          onPress={handleSignOut}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.btnText}>Confirm Logout</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 25 
  },
  card: { 
    width: '100%', 
    maxWidth: 350, 
    padding: 30, 
    borderRadius: 25, 
    alignItems: 'center', 
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ef444415',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 10 },
  subtitle: { 
    fontSize: 15, 
    textAlign: 'center', 
    lineHeight: 22, 
    marginBottom: 30,
    paddingHorizontal: 10 
  },
  logoutBtn: { 
    backgroundColor: '#ef4444', 
    width: '100%', 
    padding: 18, 
    borderRadius: 16, 
    flexDirection: 'row',
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: {
    marginTop: 20,
    padding: 10
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600'
  }
});

export default Logout;