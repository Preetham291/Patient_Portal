import React, { useState, useEffect, useCallback } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  useWindowDimensions, 
  useColorScheme, 
  Platform
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar"; 
import { collection, query, where, getDocs } from "firebase/firestore";
import { db} from '../../doctorauthentication/firebase'; 
import { themes } from "../../constants/themes";

import Loading from "../components/loading"; 
import NoInternet from "../components/nointernet";

const ProfilePage = () => {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const theme = themes[colorScheme] ?? themes.light;

  const [isOnline, setIsOnline] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [session, setSession] = useState(null);

  const loadProfile = useCallback(async () => {
    try {
      const storedData = await AsyncStorage.getItem('patientSession');
      if (storedData) {
        const parsedSession = JSON.parse(storedData);
        setSession(parsedSession);

        const q = query(
          collection(db, "patient_details"), 
          where("uid", "==", parsedSession.uid)
        );

        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const docData = querySnapshot.docs[0].data();
          setUserData(docData);
        }
      }
    } catch (error) {
      console.error("Profile Load Error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkweb = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      await fetch("https://8.8.8.8", { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
      return true;
    } catch { return false; } finally { clearTimeout(timeoutId); }
  };

  const checkConnection = useCallback(async () => {
    const state = await NetInfo.fetch();
    let status = state.isConnected === true;
    if (status) status = await checkweb();
    setIsOnline(status);
    if (status) loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    checkConnection();
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      let online = state.isConnected === true;
      if (online) online = await checkweb();
      setIsOnline(online);
    });
    return () => unsubscribe();
  }, [checkConnection]);

  if (isOnline === null || isLoading) return <Loading />;
  if (isOnline === false) return <NoInternet checkConnection={checkConnection} />;

  const ProfileItem = ({ icon, label, value, color }) => (
    <View style={[styles.infoRow, { borderBottomColor: theme.border + '30' }]}>
      <MaterialCommunityIcons name={icon} size={24} color={color || theme.primary} style={styles.rowIcon} />
      <View style={styles.textColumn}>
        <Text style={[styles.label, { color: theme.subText }]}>{label}</Text>
        <Text style={[styles.value, { color: theme.text }]}>{value || "Not Set"}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        <View style={styles.headerContainer}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>
              {userData?.patientname?.charAt(0).toUpperCase() || "P"}
            </Text>
          </View>
          <Text style={[styles.userName, { color: theme.text }]}>{userData?.patientname || "Patient User"}</Text>
          <Text style={[styles.userEmail, { color: theme.subText }]}>{userData?.patientmail}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.primary }]}>PERSONAL DETAILS</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ProfileItem icon="phone" label="Contact" value={userData?.mobile} />
            <ProfileItem icon="cake" label="Created At" value={userData?.createdAt ? new Date(userData.createdAt.seconds * 1000).toLocaleDateString() : "Not Set"} />
            <ProfileItem icon="map-marker" label="Patient ID" value={userData?.uid} />
          </View>
        </View>

       
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: {
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 80 : 60,
    marginBottom: 20,
  },
  avatarCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  avatarText: { fontSize: 44, fontWeight: 'bold', color: '#fff' },
  userName: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  userEmail: { fontSize: 14, fontWeight: '500', marginTop: 4, opacity: 0.7 },
  section: { marginTop: 25, paddingHorizontal: 20 },
  sectionHeader: { 
    fontSize: 12, 
    fontWeight: '900', 
    letterSpacing: 1.5, 
    marginBottom: 12, 
    marginLeft: 5 
  },
  card: { 
    borderRadius: 24, 
    borderWidth: 1, 
    paddingVertical: 5,
    paddingHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2
  },
  infoRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 15, 
    borderBottomWidth: 1 
  },
  rowIcon: { marginRight: 18, width: 24, textAlign: 'center' },
  textColumn: { flex: 1 },
  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  value: { fontSize: 15, fontWeight: '700' },
});

export default ProfilePage;