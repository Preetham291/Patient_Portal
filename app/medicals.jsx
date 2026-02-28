import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  StyleSheet, Text, View, Alert, ScrollView, Platform, 
  useColorScheme, TouchableOpacity, SafeAreaView, Modal, Linking, ActivityIndicator 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from "@react-native-community/netinfo";
import { db } from '../doctorauthentication/firebase'; 
import { collection, query, where, getDocs, orderBy, updateDoc, doc } from 'firebase/firestore';
import { themes } from "../constants/themes";
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import Loading from "./components/loading"; 
import NoInternet from "./components/nointernet";
import BottomTabs from './components/tabs';
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}
const PatientDetailsView = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = themes[colorScheme] ?? themes.light;

  const [isOnline, setIsOnline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null); 
  const [showSettings, setShowSettings] = useState(false);
  const [prescriptions, setPrescriptions] = useState([]);
  const [patientData, setPatientData] = useState(null);

  const [currentTime, setCurrentTime] = useState(new Date());
const alertedMedsRef = useRef(new Map()); 
  const periodNames = ["Morning", "Afternoon", "Night"];

  const getDayPeriodData = () => {
    const hours = currentTime.getHours();
    if (hours >= 5 && hours < 12) return { name: "Morning", index: 0, icon: 'weather-sunset-up' };
    if (hours >= 12 && hours < 17) return { name: "Afternoon", index: 1, icon: 'weather-sunny' };
    return { name: "Night", index: 2, icon: 'weather-night' };
  };

  const { name: currentPeriodName, index: currentPeriod, icon: phaseIcon } = getDayPeriodData();

  const getNextDoseStatus = (dosageStr, currentIdx) => {
    const parts = (dosageStr || "0-0-0").split(/[-/]/);
    
    for (let i = currentIdx + 1; i < 3; i++) {
      if (parts[i] !== "0") return `Next dose Today ${periodNames[i]}`;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    for (let i = 0; i < 3; i++) {
      if (parts[i] !== "0") return `Next dose ${dateStr} (${periodNames[i]})`;
    }
    return "No further doses scheduled";
  };
useEffect(() => {
  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        Alert.alert('Notice', 'Enable notifications in settings to receive medicine reminders.');
      }
    }
  };
  requestPermissions();
}, []);
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      if (now.getHours() !== currentTime.getHours()) {
        const oldPhase = getDayPeriodData().index;
        setCurrentTime(now);
        const newPhase = getDayPeriodData().index;
        if (oldPhase !== newPhase) alertedMedsRef.current.clear();
      } else {
        setCurrentTime(now);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [currentTime]);

  const checkweb = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
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

  const fetchMedications = async (docId) => {
    try {
      const presRef = collection(db, "patient_details", docId, "prescriptions");
      const presSnap = await getDocs(query(presRef, orderBy("createdAt", "desc")));
      const now = new Date();

      const list = presSnap.docs.map(d => ({ id: d.id, parentId: docId, ...d.data() }))
        .filter(pres => {
          if (!pres.medications || !pres.createdAt) return false;
          const createdDate = pres.createdAt.toDate();
          const msPassed = now.getTime() - createdDate.getTime();
          const daysPassed = Math.floor(msPassed / (1000 * 60 * 60 * 24));

          pres.medications = pres.medications.map(med => {
            const totalDur = parseInt(med.duration) || 0;
            const daysLeft = totalDur - daysPassed;
            
            const dosageParts = (med.dosage || "0-0-0").split(/[-/]/);
            const doseValue = dosageParts[currentPeriod] || "0";
            const doseRequiredNow = doseValue !== "0";

            return { 
              ...med, 
              daysLeft, 
              doseRequiredNow, 
              currentDoseAmount: doseValue,
              nextDoseInfo: getNextDoseStatus(med.dosage, currentPeriod)
            };
          }).filter(med => med.daysLeft >= 0);

          return pres.medications.length > 0; 
        });

      setPrescriptions(list);

      if (Platform.OS !== 'web') {
        await Notifications.cancelAllScheduledNotificationsAsync();

        list.forEach(pres => {
          pres.medications?.forEach(med => {
            const dosageParts = (med.dosage || "0-0-0").split(/[-/]/);
            
            const scheduleTimes = [8, 13, 20]; 

            dosageParts.forEach((dose, index) => {
              if (dose !== "0" && dose !== "") {
                Notifications.scheduleNotificationAsync({
                  content: {
                    title: "💊 Medicine Reminder",
                    body: `It's time to take ${dose} units of ${med.name} (${periodNames[index]})`,
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                  },
                  trigger: {
                    hour: scheduleTimes[index],
                    minute: 0,
                    repeats: true, 
                  },
                });
              }
            });
          });
        });
      }

    } catch (error) { 
      console.error("Fetch Error:", error); 
    }
  };
  useEffect(() => {
    const init = async () => {
      try {
        const stored = await AsyncStorage.getItem('patientSession');
        if (stored) {
          const { uid } = JSON.parse(stored);
          const pSnap = await getDocs(query(collection(db, "patient_details"), where("uid", "==", uid)));
          if (!pSnap.empty) {
            const pDoc = pSnap.docs[0];
            setPatientData({ id: pDoc.id, ...pDoc.data() });
            await fetchMedications(pDoc.id);
          }
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    init();
  }, [currentPeriod]); 
const sendLocalNotification = async (title, body) => {
    if (Platform.OS === 'web') return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') await Notifications.requestPermissionsAsync();
    
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  };
const checkMissedAndDueMeds = useCallback(async () => {
    if (Platform.OS === 'web') return;
    
    const now = new Date();
    const nowTs = now.getTime();
    
    prescriptions.forEach(pres => {
      pres.medications?.forEach(med => {
        const dosageParts = (med.dosage || "0-0-0").split(/[-/]/);
        
        periodNames.forEach((pName, pIdx) => {
          if (pIdx < currentPeriod) {
            const wasDoseRequired = dosageParts[pIdx] !== "0";
            const wasTaken = med.lastTakenPeriod === pName;
            
            if (wasDoseRequired && !wasTaken) {
              const missKey = `missed-${med.name}-${pName}`;
              if (!alertedMedsRef.current.has(missKey)) {
                alertedMedsRef.current.set(missKey, true);
                sendLocalNotification(
                  "⚠️ Medication Missed", 
                  `You missed your ${pName} dose of ${med.name}. Please take it if safe or consult your doctor.`
                );
              }
            }
          }
        });

        if (med.doseRequiredNow) {
          const alreadyTaken = med.lastTakenPeriod === currentPeriodName;
          
          if (!alreadyTaken) {
            const dueKey = `due-${med.name}-${currentPeriod}`;
            const lastAlertTime = alertedMedsRef.current.get(dueKey) || 0;
            const threeHoursInMs = 3 * 60 * 60 * 1000;

            if (nowTs - lastAlertTime > threeHoursInMs) {
              alertedMedsRef.current.set(dueKey, nowTs);
              sendLocalNotification(
                "🔔 Medicine Reminder", 
                `It's time for your ${currentPeriodName} dose of ${med.name}. Dose: ${med.currentDoseAmount} units.`
              );
            }
          }
        }
      });
    });
  }, [prescriptions, currentPeriod, currentPeriodName]);
 useEffect(() => {
    const timer = setInterval(() => {
      if (Platform.OS !== 'web') {
        checkMissedAndDueMeds();
      }
    }, 10000); 
    
    return () => clearInterval(timer);
  }, [checkMissedAndDueMeds]);
  const handleTakeTablet = async (presId, parentId, medIndex, meds) => {
    const med = meds[medIndex];
    if (!med.doseRequiredNow) return; 
    const online = await checkConnection();
    if (!online) return;

    const processAction = async () => {
      setProcessingId(`${presId}-${medIndex}`);
      const updatedMeds = [...meds];
      updatedMeds[medIndex] = {
        ...med,
        lastTaken: new Date().toISOString(),
        lastTakenPeriod: currentPeriodName
      };

      try {
        const presDocRef = doc(db, "patient_details", parentId, "prescriptions", presId);
        await updateDoc(presDocRef, { medications: updatedMeds });
        await fetchMedications(parentId);
      } catch (e) { console.error("Update failed:", e); } finally { setProcessingId(null); }
    };

    if (Platform.OS === 'web') {
        if (window.confirm(`Have you taken ${med.name}?`)) processAction();
    } else {
        Alert.alert("Confirm", `Have you taken ${med.name}?`, [
            { text: "No", style: "cancel" },
            { text: "Yes", onPress: processAction }
        ]);
    }
  };

  const handleSOS = () => {
    if (Platform.OS === 'web') return window.alert("Emergency calling is mobile only.");
    Linking.openURL('tel:108');
  };

  if (isOnline === null || loading) return <Loading />;
  if (isOnline === false) return <NoInternet checkConnection={checkConnection} />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      
      <View style={styles.staticTop}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.subText }]}>Hello,</Text>
            <Text style={[styles.headerTitle, { color: theme.text }]}>My Health</Text>
          </View>
          <TouchableOpacity style={[styles.iconCircle, { backgroundColor: theme.card }]} onPress={() => setShowSettings(true)}>
            <Ionicons name="settings-outline" size={22} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View style={[styles.statusBanner, { backgroundColor: '#00AEEF' }]}>
            <View style={styles.bannerInfo}>
                <MaterialCommunityIcons name={phaseIcon} size={28} color="#fff" />
                <View style={{ marginLeft: 12 }}>
                    <Text style={styles.bannerTitle}>{currentPeriodName.toUpperCase()} PHASE</Text>
                    <Text style={styles.bannerSub}>Time: {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
            </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.listSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Medication Schedule</Text>
          
          {prescriptions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="sticker-check-outline" size={64} color={theme.border} />
              <Text style={[styles.emptyText, { color: theme.subText }]}>No active medications found.</Text>
            </View>
          ) : (
            prescriptions.map((pres) => (
              <View key={pres.id} style={[styles.card, { backgroundColor: theme.card, shadowColor: theme.text }]}>
                <View style={styles.cardHeader}>
                  <View style={styles.diagnosisBadge}><Text style={styles.diagnosisText}>{pres.diagnosis?.toUpperCase() || "GENERAL"}</Text></View>
                  <Text style={[styles.dateText, { color: theme.subText }]}>Prescription Active</Text>
                </View>

                {pres.medications.map((med, idx) => {
                  const isDone = med.lastTakenPeriod === currentPeriodName;
                  const isProcessing = processingId === `${pres.id}-${idx}`;
                  const notNeededNow = !med.doseRequiredNow;

                  return (
                    <TouchableOpacity 
                      key={idx}
                      activeOpacity={0.8}
                      disabled={isDone || isProcessing || notNeededNow}
                      onPress={() => handleTakeTablet(pres.id, pres.parentId, idx, pres.medications)}
                      style={[styles.medCard, { backgroundColor: theme.background, borderColor: isDone ? '#10b981' : theme.border }, notNeededNow && { opacity: 0.7 }]}
                    >
                      <View style={[styles.iconBox, { backgroundColor: isDone ? '#10b98120' : '#00AEEF15' }]}>
                        {isProcessing ? <ActivityIndicator size="small" color="#00AEEF" /> : 
                          <MaterialCommunityIcons name={isDone ? "check-circle" : (notNeededNow ? "clock-outline" : "pill")} size={24} color={isDone ? '#10b981' : (notNeededNow ? theme.subText : '#00AEEF')} />
                        }
                      </View>
                      
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.medName, { color: theme.text, textDecorationLine: isDone ? 'line-through' : 'none' }]}>{med.name}</Text>
                        <Text style={[styles.medMeta, { color: isDone ? '#10b981' : theme.subText }]}>
                           {isDone ? "Dose completed" : (notNeededNow ? med.nextDoseInfo : `Take ${med.currentDoseAmount} Units now`)}
                        </Text>
                      </View>

                      {isDone ? (
                        <View style={styles.doneBadge}><Text style={styles.doneText}>DONE</Text></View>
                      ) : (
                        !notNeededNow && <Ionicons name="chevron-forward" size={18} color={theme.border} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.sosButton} onPress={handleSOS}>
        <MaterialCommunityIcons name="phone-plus" size={28} color="#fff" />
        <Text style={styles.sosText}>SOS</Text>
      </TouchableOpacity>
      <BottomTabs />

      <Modal visible={showSettings} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, {color: theme.text}]}>Account</Text>
                <TouchableOpacity onPress={() => setShowSettings(false)}><Ionicons name="close-circle" size={32} color={theme.border} /></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.menuBtn} onPress={() => router.push("/(others)/profile")}>
                <Ionicons name="person-outline" size={22} color={theme.text} /><Text style={{color: theme.text, fontSize: 16, marginLeft: 12, fontWeight: '600'}}>My Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuBtn} onPress={() => router.push("/(others)/logout")}>
                <Ionicons name="log-out-outline" size={22} color="#ef4444" /><Text style={{color: "#ef4444", fontSize: 16, marginLeft: 12, fontWeight: '600'}}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10 },
  staticTop: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 15 },
  greeting: { fontSize: 14, fontWeight: '600', marginBottom: -2 },
  headerTitle: { fontSize: 28, fontWeight: '900' },
  iconCircle: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowOpacity: 0.1, shadowRadius: 5 },
  statusBanner: { padding: 18, borderRadius: 20, flexDirection: 'row', alignItems: 'center', elevation: 4, shadowColor: '#00AEEF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3 },
  bannerInfo: { flexDirection: 'row', alignItems: 'center' },
  bannerTitle: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  bannerSub: { color: '#ffffffcc', fontSize: 12, fontWeight: '500' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 160 },
  listSection: { marginTop: 25 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15 },
  card: { borderRadius: 24, padding: 15, marginBottom: 20, elevation: 3, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  diagnosisBadge: { backgroundColor: '#00AEEF15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  diagnosisText: { fontSize: 11, fontWeight: '800', color: '#00AEEF' },
  dateText: { fontSize: 11, fontWeight: '600' },
  medCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 18, borderWidth: 1, marginBottom: 10 },
  iconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  medName: { fontSize: 16, fontWeight: '700' },
  medMeta: { fontSize: 12, marginTop: 3, fontWeight: '600' },
  doneBadge: { backgroundColor: '#10b98115', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  doneText: { fontSize: 10, fontWeight: '900', color: '#10b981' },
  sosButton: { position: 'absolute', bottom: 90, right: 20, backgroundColor: '#ef4444', width: 65, height: 65, borderRadius: 32.5, alignItems: 'center', justifyContent: 'center', elevation: 8 },
  sosText: { color: '#fff', fontWeight: '900', fontSize: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30, minHeight: 250 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  menuBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#00000005' },
  emptyContainer: { alignItems: 'center', marginTop: 60, opacity: 0.8 },
  emptyText: { fontSize: 15, fontWeight: '600', marginTop: 15, textAlign: 'center' }
});

export default PatientDetailsView;