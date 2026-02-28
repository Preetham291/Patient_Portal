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
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar"; 
import { themes } from "../../constants/themes";

import Loading from "../components/loading"; 
import NoInternet from "../components/nointernet";

const TermsPage = () => {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const theme = themes[colorScheme] ?? themes.light;

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

  const titleSize = width > 600 ? 32 : 26;
  const pointTitleSize = width > 600 ? 20 : 17;

  if (isOnline === null) return <Loading />;
  if (isOnline === false) return <NoInternet checkConnection={checkConnection} />;

 const termsPoints = [
    { id: 1, title: "Data Privacy & HIPAA", desc: "Your health records are protected under strict medical privacy laws. We use industry-standard encryption to keep your data safe." },
    { id: 2, title: "Personal Responsibility", desc: "You are responsible for maintaining the confidentiality of your login credentials. Do not share your password with anyone." },
    { id: 3, title: "Accurate Information", desc: "Please ensure all personal and insurance details provided are accurate to avoid complications in your medical care." },
    { id: 4, title: "Medical Advice Disclaimer", desc: "The information in this portal is for record-keeping and communication. In case of a medical emergency, please call local emergency services immediately." },
    { id: 5, title: "Secure Communication", desc: "Messages sent to doctors through this portal are saved to your medical record. Professional conduct is expected at all times." },
    { id: 6, title: "Access to Records", desc: "You have the right to view and download your laboratory results and prescriptions as soon as they are released by your provider." },
    { id: 7, title: "Device Security", desc: "Always log out from public computers. We recommend using biometric locks (FaceID/Fingerprint) if your device supports them." },
    { id: 8, title: "Appointment Policy", desc: "Cancellations or rescheduling of appointments made via this portal must be done at least 24 hours in advance." },
    { id: 9, title: "Third-Party Sharing", desc: "We never sell your medical data. Information is only shared with authorized pharmacies or labs necessary for your treatment." },
    { id: 10, title: "Audit & Logs", desc: "For your security, we log all access to your records. You can request an access report if you suspect unauthorized activity." },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <View style={[
        styles.header, 
        { 
          backgroundColor: theme.card, 
          borderBottomColor: theme.border 
        }
      ]}>
        <Text style={[styles.headerTitle, { color: theme.text, fontSize: titleSize }]}>
          Terms & Policy
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.subText }]}>
        Patient Privacy & Security Policy
        </Text>
      </View>

      <ScrollView 
        style={styles.scrollArea} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60, paddingTop: 10 }}
      >
        {termsPoints.map((point) => (
          <View key={point.id} style={[styles.pointBox, { borderBottomColor: theme.border }]}>
            <View style={styles.titleRow}>
              <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
                <Ionicons name="shield-checkmark" size={18} color={theme.primary} />
              </View>
              <Text style={[styles.pointTitle, { color: theme.text, fontSize: pointTitleSize }]}>
                {point.title}
              </Text>
            </View>
            <Text style={[styles.pointDescription, { color: theme.subText }]}>
              {point.desc}
            </Text>
          </View>
        ))}

        <View style={styles.footer}>
           <Text style={[styles.footerText, { color: theme.subText }]}>
             Last Updated: February 2026
           </Text>
           <Text style={[styles.footerText, { color: theme.subText }]}>
             Version 2.4.0 (Stable)
           </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingHorizontal: 25,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  headerTitle: { fontWeight: "900", letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 14, fontWeight: "600", marginTop: 4 },
  scrollArea: { flex: 1, paddingHorizontal: 20 },
  pointBox: {
    paddingVertical: 22,
    borderBottomWidth: 1,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  pointTitle: { fontWeight: "800" },
  pointDescription: { fontSize: 15, lineHeight: 24, paddingLeft: 44 },
  footer: {
    marginTop: 40,
    alignItems: 'center',
    paddingBottom: 20
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.6,
    marginBottom: 4
  }
});

export default TermsPage;