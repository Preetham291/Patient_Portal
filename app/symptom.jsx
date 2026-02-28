import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, Platform, useColorScheme, SafeAreaView, Alert, ActivityIndicator, Modal, Linking 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from "@react-native-community/netinfo";
import { db } from '../doctorauthentication/firebase'; 
import { 
  collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot, doc, updateDoc, deleteDoc 
} from 'firebase/firestore';
import { themes } from "../constants/themes";
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import Loading from "./components/loading"; 
import NoInternet from "./components/nointernet";
import { useRouter } from 'expo-router';
import BottomTabs from './components/tabs';

const universalAlert = (title, message, buttons = []) => {
  if (Platform.OS === 'web') {
    if (buttons.length > 0) {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) {
        const primaryAction = buttons.find(b => b.text === "Yes" || b.text === "Delete");
        if (primaryAction) primaryAction.onPress();
      }
    } else {
      window.alert(`${title}: ${message}`);
    }
  } else {
    Alert.alert(title, message, buttons);
  }
};

const MenuButton = ({ title, icon, color, bgColor, onPress, theme }) => (
  <TouchableOpacity 
    style={[styles.menuBtn, { backgroundColor: bgColor }]} 
    onPress={onPress}
  >
    <View style={styles.menuIconContainer}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.menuText, { color: theme.text }]}>{title}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={theme.subText} />
  </TouchableOpacity>
);

const symptoms = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = themes[colorScheme] ?? themes.light;
  
  const [inputText, setInputText] = useState('');
  const [isOnline, setIsOnline] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [loadingData, setLoadingData] = useState(true); 
  const [patientDocId, setPatientDocId] = useState('');
  const [activeSymptoms, setActiveSymptoms] = useState([]);
  const [solvedSymptoms, setSolvedSymptoms] = useState([]);
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const checkweb = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    try {
      await fetch("https://8.8.8.8", { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
      return true;
    } catch {
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

  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedData = await AsyncStorage.getItem('patientSession');
        if (storedData) {
          const parsed = JSON.parse(storedData);
          const q = query(collection(db, "patient_details"), where("uid", "==", parsed.uid));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setPatientDocId(snap.docs[0].id);
          } else {
            setLoadingData(false); 
          }
        }
      } catch (e) { 
        console.error("Session Error:", e);
        setLoadingData(false);
      } finally { 
        setIsReady(true); 
      }
    };
    loadSession();
  }, []);

  useEffect(() => {
    if (!patientDocId) return;
    setLoadingData(true); 
    const symptomsRef = collection(db, "patient_details", patientDocId, "symptoms");
    
    const unsubscribe = onSnapshot(symptomsRef, (snapshot) => {
      const allItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const active = allItems.filter(item => !item.solved).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      const solved = allItems.filter(item => item.solved).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setActiveSymptoms(active);
      setSolvedSymptoms(solved);
      setLoadingData(false); 
    }, (error) => {
      console.error("Snapshot Error:", error);
      setLoadingData(false);
    });
    return () => unsubscribe();
  }, [patientDocId]);

  const handleSendSymptom = async () => {
    if (!inputText.trim() || !patientDocId) return;
    const online = await checkConnection();
    if (!online) return;

    setSending(true);
    try {
      const symptomsRef = collection(db, "patient_details", patientDocId, "symptoms");
      await addDoc(symptomsRef, {
        description: inputText,
        solved: false,
        timestamp: serverTimestamp(),
        type: 'text',
      });
      setInputText('');
    } catch (error) {
      universalAlert("Error", "Failed to save symptom.");
    } finally { setSending(false); }
  };

  const markAsSolved = async (symptomId) => {
    const online = await checkConnection();
    if (!online) return;

    universalAlert("Is this symptom resolved?", "Click 'Yes' if it has been resolved.", [
      { text: "No", style: "cancel" },
      { text: "Yes", onPress: async () => {
          try {
            const docRef = doc(db, "patient_details", patientDocId, "symptoms", symptomId);
            await updateDoc(docRef, { solved: true });
          } catch (e) {
            universalAlert("Error", "Update failed");
          }
      }}
    ]);
  };

  const deleteSymptom = async (symptomId) => {
    const online = await checkConnection();
    if (!online) return;
    

    universalAlert("Delete Record?", "This will permanently remove this symptom.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", onPress: async () => {
          try {
            const docRef = doc(db, "patient_details", patientDocId, "symptoms", symptomId);
            await deleteDoc(docRef);
          } catch (e) {
            universalAlert("Error", "Could not delete.");
          }
      }, style: 'destructive'}
    ]);
  };

  const handleSOS = () => {
    if (Platform.OS === 'web') {
      universalAlert("SOS", "Emergency calling is only available on mobile.");
      return;
    }
    Alert.alert("Emergency SOS", "Call emergency services?", [
      { text: "Cancel", style: "cancel" },
      { text: "Call Now", onPress: () => Linking.openURL('tel:108'), style: 'destructive' }
    ]);
  };

  const handleNavigation = (path) => {
    setShowSettings(false);
    router.push(path);
  };

  if (isOnline === null || !isReady) return <Loading />;
  if (isOnline === false) return <NoInternet checkConnection={checkConnection} />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background ,paddingTop:10 }]}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      
      <View style={[styles.staticTop,{...Platform.OS!=="web" ? {height:220} : {}}]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Symptoms</Text>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={26} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text, outlineStyle: 'none' ,borderWidth:2,borderColor: theme.border,padding:10,borderRadius:8}]}
            placeholder="How are you feeling?"
            placeholderTextColor={theme.subText}
            value={inputText}
            onChangeText={setInputText}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity 
            style={[styles.squareSendBtn, { backgroundColor: theme.primary, opacity: inputText.trim() && !sending ? 1 : 0.6 }]}
            onPress={handleSendSymptom}
            disabled={sending || !inputText.trim()}
          >
            <Text style={styles.sendText}>{sending ? "Sending..." : "Send Report"}</Text>
            {!sending && <Ionicons name="paper-plane" size={14} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.listSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Current Symptoms</Text>
          {loadingData ? <ActivityIndicator size="small" color={theme.primary} /> : 
           activeSymptoms.length === 0 ? <Text style={[styles.emptyText, { color: theme.subText }]}>No current symptoms.</Text> :
           activeSymptoms.map((item) => (
            <View key={item.id} style={[styles.symptomCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardLeft}><Text style={[styles.symptomDesc, { color: theme.text }]}>{item.description}</Text></View>
              <TouchableOpacity onPress={() => markAsSolved(item.id)}><MaterialCommunityIcons name="checkbox-blank-outline" size={26} color={theme.primary} /></TouchableOpacity>
            </View>
          ))}
        </View>

        {solvedSymptoms.length > 0 && (
          <View style={[styles.listSection, { marginTop: 40 }]}>
            <Text style={[styles.sectionTitle, { color: theme.subText, fontSize: 18 }]}>Previous Symptoms</Text>
            {solvedSymptoms.map((item) => (
              <View key={item.id} style={[styles.symptomCard, styles.solvedCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.cardLeft}>
                  <Text style={[styles.symptomDesc, { color: theme.subText, textDecorationLine: 'line-through' }]}>{item.description}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteSymptom(item.id)} style={{ padding: 10 }}><Ionicons name="trash-outline" size={20} color="#ef4444" /></TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.sosButton} onPress={handleSOS} activeOpacity={0.8}>
        <MaterialCommunityIcons name="phone-plus" size={28} color="#fff" />
        <Text style={styles.sosText}>SOS</Text>
      </TouchableOpacity>

      <BottomTabs />

      <Modal visible={showSettings} animationType="fade" transparent={true} onRequestClose={() => setShowSettings(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
            </View>
            <View style={styles.menuList}>
              <MenuButton title="Profile Info" icon="person-circle-outline" color="#3b82f6" bgColor="#3b82f615" onPress={() => handleNavigation("/(others)/profile")} theme={theme} />
              <MenuButton title="Change Password" icon="lock-closed-outline" color="#8b5cf6" bgColor="#8b5cf615" onPress={() => handleNavigation("/(others)/changepassword")} theme={theme} />
              <MenuButton title="Terms & Policy" icon="shield-checkmark-outline" color="#475569" bgColor="#47556915" onPress={() => handleNavigation("/(others)/terms")} theme={theme} />
              <MenuButton title="Logout" icon="log-out-outline" color="#ef4444" bgColor="#ef444415" onPress={() => handleNavigation("/(others)/logout")} theme={theme} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 15, paddingBottom: 160 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '900' },
  inputBox: { padding: 15, ...Platform.OS!=="web" ? { paddingBottom: 70 } : {}, borderWidth: 1, borderLeftWidth: 6, borderLeftColor: '#00AEEF', elevation: 2 },
  input: { flex: 1, fontSize: 16, minHeight: 80 },
  squareSendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, marginTop: 15, gap: 8 },
  sendText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  listSection: { marginTop: 30 },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 15 },
  emptyText: { fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 40 },
  symptomCard: { flexDirection: 'row', padding: 18, borderWidth: 1, borderLeftWidth: 6, borderLeftColor: '#00AEEF', marginBottom: 12, alignItems: 'center' },
  solvedCard: { opacity: 0.6, borderLeftColor: '#94a3b8' },
  cardLeft: { flex: 1 },
  symptomDesc: { fontSize: 16, fontWeight: '600' },
  sosButton: { position: 'absolute', bottom: 85, right: 20, backgroundColor: '#ef4444', width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', elevation: 10, zIndex: 999, borderWidth: 3, borderColor: '#fff' },
  sosText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 22, fontWeight: '800' },
  menuList: { gap: 12 },
  menuBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 12 },
  menuIconContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  staticTop: { paddingHorizontal: 15, paddingTop:  10 },
  menuText: { fontSize: 16, fontWeight: '600' },
});

export default symptoms;