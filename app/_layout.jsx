import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../doctorauthentication/firebase'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import Loading from './components/loading'; 

const _layout = () => {
  const segments = useSegments();
  const router = useRouter();
  
  const [isReady, setIsReady] = useState(false); 
  const [currUser, setCurrUser] = useState(null);
  const [sessionExists, setSessionExists] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        const storedSession = await AsyncStorage.getItem('patientSession');
        setSessionExists(!!storedSession);
        setCurrUser(user);
      } catch (error) {
        setSessionExists(false);
      } finally {
        setIsReady(true);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const checkNavigation = async () => {
      const storedSession = await AsyncStorage.getItem('patientSession');
      const hasValidSession = !!storedSession;
      
      const inAuthGroup = segments[0] === 'login' || segments[0] === 'index' || !segments[0];

      if (currUser && hasValidSession) {
        if (inAuthGroup) {
          router.replace('/home');
        }
      } else {
        if (!inAuthGroup) {
          router.replace('/login');
        }
      }
    };

    checkNavigation();
  }, [currUser, segments, isReady]);

  if (!isReady) return <Loading />; 

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="+not-found" />
      <Stack.Screen name="login" />
      <Stack.Screen name="(others)" />
      <Stack.Screen name="symptom" />
      <Stack.Screen name="home" />
      <Stack.Screen name="medicals" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="doctorai" />
    </Stack>
  );
}

export default _layout;