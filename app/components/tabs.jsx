import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { themes } from "../../constants/themes";

const BottomTabs = () => {
  const router = useRouter();
  const theme = themes[useColorScheme()] ?? themes.light;

  const commonBtnBackground = theme.mode === 'dark' ? '#1e293b' : '#f1f5f9'; 
  const iconColor = theme.mode === 'dark' ? '#cbd5e1' : '#475569'; 

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderTopColor: theme.border,paddingTop: 10 }]}>
      <SafeAreaView edges={['bottom']} style={styles.tabBar}>
        
        <TouchableOpacity 
          style={[styles.tabButton, { backgroundColor: commonBtnBackground }]} 
          onPress={() => router.replace('../home')}
        >
          <MaterialCommunityIcons name="home" size={22} color={iconColor} />
          <Text style={[styles.label, { color: iconColor }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, { backgroundColor: commonBtnBackground }]} 
          onPress={() => router.replace('../medicals')}
        >
          <MaterialCommunityIcons name="medication" size={22} color={iconColor} />
          <Text style={[styles.label, { color: iconColor }]}>Meds</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, { backgroundColor: commonBtnBackground }]} 
          onPress={() => router.replace('../reports')}
        >
          <MaterialCommunityIcons name="flask" size={22} color={iconColor} />
          <Text style={[styles.label, { color: iconColor }]}>Labs</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, { backgroundColor: commonBtnBackground }]} 
          onPress={() => router.replace('../doctorai')}
        >
          <MaterialCommunityIcons name="robot" size={22} color={iconColor} />
          <Text style={[styles.label, { color: iconColor }]}>AI</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, { backgroundColor: commonBtnBackground }]} 
          onPress={() => router.replace('../symptom')}
        >
          <MaterialCommunityIcons name="clipboard-text" size={22} color={iconColor} />
          <Text style={[styles.label, { color: iconColor }]}>Records</Text>
        </TouchableOpacity>

      </SafeAreaView>
    </View>
  );
};

export default BottomTabs;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    zIndex: 10,
  },
  tabBar: {
    flexDirection: 'row',
    height: 75,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
   
  },
  tabButton: {
    width: '18%', 
    height: 55,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
});