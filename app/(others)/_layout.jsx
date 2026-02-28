import React from 'react';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { themes } from '../../constants/themes'; 

export default function OthersLayout() {
  const colorScheme = useColorScheme();
  const theme = themes[colorScheme] ?? themes.light;

  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        contentStyle: { backgroundColor: theme.background } 
      }}
    >
      <Stack.Screen name="changepassword" />
      <Stack.Screen name="logout" />
      <Stack.Screen name="terms" />
    </Stack>
  );
}