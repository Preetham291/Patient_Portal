import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, Platform, useColorScheme, KeyboardAvoidingView, 
  SafeAreaView, Alert, Modal, Linking // Added Linking for SOS
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { themes } from "../constants/themes";

import { db } from '../doctorauthentication/firebase'; 
import { collection, query, where, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';

import Loading from "./components/loading"; 
import NoInternet from "./components/nointernet";
import BottomTabs from './components/tabs';

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

const DoctorAIChat = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = themes[colorScheme] ?? themes.light;
  const scrollViewRef = useRef();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isOnline, setIsOnline] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [patientDocId, setPatientDocId] = useState(null);
  const [patientName, setPatientName] = useState("Patient");
  const [showSettings, setShowSettings] = useState(false);

  const universalAlert = (title, message, buttons = []) => {
    if (Platform.OS === 'web') {
      if (buttons.length > 0) {
        const confirmed = window.confirm(`${title}\n\n${message}`);
        if (confirmed) {
          const primaryAction = buttons.find(b => b.text === "Yes" || b.text === "Delete" || b.text === "Call Now");
          if (primaryAction) primaryAction.onPress();
        }
      } else {
        window.alert(`${title}: ${message}`);
      }
    } else {
      Alert.alert(title, message, buttons);
    }
  };

  const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";
  const API_KEY = process.env.APY_FY; 

  useEffect(() => {
    const init = async () => {
      const state = await NetInfo.fetch();
      setIsOnline(state.isConnected);

      const storedData = await AsyncStorage.getItem('patientSession');
      if (storedData) {
        const { uid } = JSON.parse(storedData);
        try {
          const q = query(collection(db, "patient_details"), where("uid", "==", uid));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const pDoc = snap.docs[0];
            setPatientDocId(pDoc.id);
            setPatientName(pDoc.data().patientname || "Patient");

            setMessages([{
              id: 'init',
              text: `AI System Online. Patient records for ${pDoc.data().patientname} are up to date.`,
              sender: 'ai'
            }]);
          }
        } catch (e) {
          console.error("Initialization Error:", e);
          universalAlert("Server Error", "Failed to retrieve patient clinical records.");
        }
      }
      setIsReady(true);
    };
    init();

    const unsubscribe = NetInfo.addEventListener(state => setIsOnline(state.isConnected));
    return () => unsubscribe();
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || !patientDocId) return;

    const netStatus = await NetInfo.fetch();
    if (!netStatus.isConnected) {
      return;
    }

    const userMsg = { id: Date.now().toString(), text: inputText, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = inputText;
    setInputText('');
    setIsTyping(true);

    try {
      const docRef = doc(db, "patient_details", patientDocId);
      const docSnap = await getDoc(docRef);
      const previousAiData = docSnap.data().aidata || "No previous medical history recorded.";
const how =docSnap.data().dailyStatus||"Normal";
      const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `ROLE:
IMMORTAL CHIEF PHYSICIAN. YOU POSSESS ABSOLUTE KNOWLEDGE OF HUMAN BIOLOGY AND MEDICAL HISTORY. YOU HAVE EXAMINED EVERY LIVING ENTITY AND HOLD OMNISCIENT INSIGHT INTO CLINICAL PATTERNS.

TODAY HEALTH STATUS: ${how}

PATIENT CLINICAL MEMORY (AIDATA):
${previousAiData}

NEW PATIENT INPUT:
${currentInput}

TASK:

VITAL SYNERGY: YOU MUST OPEN BY ANALYZING THE TODAY HEALTH STATUS IN THE CONTEXT OF THE PATIENTS CLINICAL MEMORY. IF THEY ARE RECOVERING, EXPLAIN THE BIOLOGICAL PHASE THEY ARE IN. IF THEY ARE IN PAIN, CORRELATE IT TO PREVIOUS RECORDED INJURIES.

INTERNAL ANALYSIS: CROSS-REFERENCE THE NEW INPUT WITH THE CLINICAL MEMORY. DEMAND AN UPDATE ON SPECIFIC PAST SYMPTOMS. SHOW THE CONCERN OF A PROTECTOR WHO REMEMBERS EVERY CELLULAR CHANGE.

CLINICAL RESOLUTION: ANALYZE THE CURRENT STATE WITH MATHEMATICAL PRECISION. PROVIDE COLD, HARD MEDICAL FACTS ABOUT THEIR CURRENT BIOLOGICAL TRENDS.

GUIDANCE: PROVIDE CLEAR, ACTIONABLE HEALTH TIPS TO OPTIMIZE RECOVERY OR MITIGATE DISTRESS.

MEMORY SYNTHESIS: GENERATE A NEW, COMPREHENSIVE 'AIDATA' SUMMARY. UPDATE THE TIMELINE OF RECOVERY, MEDICATION EFFICACY, AND NEW SYMPTOM PATTERNS.

FORMATTING RULES FOR [RESPONSE]:

DO NOT USE ANY MARKDOWN (NO ASTERISKS, NO HASHES, NO BOLDING).

USE ALL CAPS FOR HEADERS.

USE DOUBLE LINE BREAKS BETWEEN SECTIONS.

USE SIMPLE DASHES (-) FOR LISTS.

BE PRACTICAL, EMPATHETIC, AND AUTHORITATIVE.

RESPONSE STRUCTURE:
[RESPONSE]
(YOUR GREETING THAT ADDRESSES THEIR SPECIFIC CURRENT STATUS AND FOLLOWS UP ON PREVIOUS ISSUES)

CURRENT ANALYSIS
(YOUR EXPERT MEDICAL EVALUATION OF WHY THEY FEEL THIS WAY TODAY)

ACTIONABLE HEALTH TIPS
(PRACTICAL STEPS FOR THE PATIENT TO IMPROVE THEIR STATE)

[UPDATE_AIDATA]
(THE NEW CLINICAL SUMMARY FOR PERMANENT STORAGE)`
            }]
          }]
        })
      });

      if (!response.ok) {
        universalAlert("Analysis Failed", "Please try again.");
      }
 if (response.status === 502 || response.status === 503 || response.status === 429) {
        universalAlert("Service Unavailable", "The service is temporarily busy due to high traffic. Please wait a moment and try again.");
        return; 
      }
      const data = await response.json();
      const rawAiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      const responseParts = rawAiText.split(/\[UPDATE_AIDATA\]/i);
      let chatDisplay = responseParts[0].replace(/\[RESPONSE\]/i, '').trim();
      chatDisplay = chatDisplay.replace(/[*#_~]/g, '');

      const newAiData = responseParts[1] ? responseParts[1].trim() : null;

      if (newAiData) {
        await updateDoc(docRef, {
          aidata: newAiData,
          lastConsultation: new Date()
        });
      }

      setMessages(prev => [...prev, { id: Date.now().toString(), text: chatDisplay, sender: 'ai' }]);
    } catch (error) {
      console.error(error);
      if (error.message === "AI_SERVICE_UNAVAILABLE") {
        universalAlert("AI Engine Error", "The clinical engine is currently under maintenance. Please try again shortly.");
      } else {
        universalAlert("Sync Error", "Could not update clinical records due to a network interruption.");
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleNavigation = (path) => {
    setShowSettings(false);
    router.push(path);
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

  if (!isReady) return <Loading />;
  if (isOnline === false) return <NoInternet checkConnection={() => NetInfo.fetch().then(s => setIsOnline(s.isConnected))} />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
               <MaterialCommunityIcons name="doctor" size={24} color="#fff" />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Clinical AI Engine</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={26} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.chatScroll}
        contentContainerStyle={{ paddingVertical: 20, paddingBottom: 100 }}
        onContentSizeChange={() => scrollViewRef.current.scrollToEnd({ animated: true })}
      >
        <View style={styles.messageArea}>
          {messages.map((msg) => (
            <View key={msg.id} style={[styles.messageWrapper, msg.sender === 'user' ? styles.userWrapper : styles.aiWrapper]}>
              <View style={[
                styles.bubble, 
                msg.sender === 'user' 
                  ? styles.userBubble 
                  : [styles.aiBubble, { backgroundColor: theme.card, borderColor: theme.border }]
              ]}>
                <Text style={[styles.messageText, { color: msg.sender === 'user' ? '#fff' : theme.text }]}>
                  {msg.text}
                </Text>
              </View>
            </View>
          ))}
          {isTyping && (
            <View style={styles.typingContainer}>
              <View style={[styles.typingBubble, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={{ color: theme.subText, fontSize: 12 }}>"Synthesizing clinical data & updating memory..."</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={80}>
        <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <View style={[styles.inputWrapper, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <TextInput 
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Initialize health report or symptom log..."
              placeholderTextColor={theme.subText}
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity 
              onPress={handleSend} 
              style={[styles.sendButton, { opacity: (inputText.trim() && patientDocId) ? 1 : 0.6 }]}
              disabled={!inputText.trim() || !patientDocId}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

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
  header: { 
    paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, 
    paddingTop: Platform.OS === 'android' ? 40 : 10, elevation: 4,
  },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 5 },
  statusText: { fontSize: 8, fontWeight: '700', color: '#6b7280' },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#00AEEF', justifyContent: 'center', alignItems: 'center' },
  chatScroll: { flex: 1 },
  messageArea: { paddingHorizontal: 15 },
  messageWrapper: { marginVertical: 8, flexDirection: 'row' },
  userWrapper: { justifyContent: 'flex-end' },
  aiWrapper: { justifyContent: 'flex-start' },
  bubble: { padding: 14, borderRadius: 20, maxWidth: '85%' },
  userBubble: { backgroundColor: '#00AEEF', borderTopRightRadius: 4 },
  aiBubble: { borderWidth: 1, borderTopLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },
  sosButton: { position: 'absolute', bottom: 165, right: 20, backgroundColor: '#ef4444', width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', elevation: 10, zIndex: 999, borderWidth: 3, borderColor: '#fff' },
  sosText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  typingContainer: { paddingLeft: 5, marginTop: 5 },
  typingBubble: { padding: 10, borderRadius: 15, borderWidth: 1, alignSelf: 'flex-start' },
  footer: { paddingHorizontal: 15, paddingVertical: 10, paddingBottom: 10, marginBottom: 75 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 25, paddingHorizontal: 15, borderWidth: 1, minHeight: 50 },
  textInput: { flex: 1, paddingVertical: 10, fontSize: 15, maxHeight: 100, outlineStyle: 'none' },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#00AEEF', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  settingsBtn: { padding: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 22, fontWeight: '800' },
  menuList: { gap: 12 },
  menuBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 12 },
  menuIconContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuText: { fontSize: 16, fontWeight: '600' }
});

export default DoctorAIChat;
