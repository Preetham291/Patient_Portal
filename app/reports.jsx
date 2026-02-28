import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, useColorScheme, SafeAreaView, ActivityIndicator, Modal, Alert, Image, Platform, Linking
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator'; 
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { db } from '../doctorauthentication/firebase'; 
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';

import { themes } from "../constants/themes";
import Loading from "./components/loading"; 
import NoInternet from "./components/nointernet";
import BottomTabs from './components/tabs';

const GEMINI_API_KEY = 'AIzaSyBAyRRMSKIHOvweoZSjB7mrsdl2VDpj-Xk'; 
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

const MenuButton = ({ title, icon, color, bgColor, onPress, theme }) => (
  <TouchableOpacity style={[styles.menuBtn, { backgroundColor: bgColor }]} onPress={onPress}>
    <View style={styles.menuIconContainer}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.menuText, { color: theme.text }]}>{title}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={theme.subText} />
  </TouchableOpacity>
);

const Reports = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = themes[colorScheme] ?? themes.light;

  const [analysis, setAnalysis] = useState('');
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentImg, setCurrentImg] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [isOnline, setIsOnline] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [patientDocId, setPatientDocId] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [language, setlanguage] = useState('English');
  const [history, setHistory] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  const checkConnection = useCallback(async () => {
    const state = await NetInfo.fetch();
    setIsOnline(state.isConnected);
    return state.isConnected;
  }, []);

  useEffect(() => {
    checkConnection();
    const unsubscribe = NetInfo.addEventListener(state => setIsOnline(state.isConnected));
    return () => unsubscribe();
  }, [checkConnection]);

  const ensureConnection = async () => {
    const connected = await checkConnection();
    if (!connected) {
      Alert.alert("No Connection", "Please check your internet and try again.");
      return false;
    }
    return true;
  };

  const fetchAllHistory = useCallback(async (docId) => {
    const online = await checkConnection();
    if (!online) return;

    const targetId = docId || patientDocId;
    if (!targetId) return;
    
    setHistoryLoading(true);
    try {
      const ref = collection(db, "patient_details", targetId, "reports");
      const q = query(ref, orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setHistory(data);
    } catch (e) {
      console.error("Fetch History Error:", e);
    } finally {
      setHistoryLoading(false);
    }
  }, [patientDocId, checkConnection]);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedData = await AsyncStorage.getItem('patientSession');
        if (storedData) {
          const parsed = JSON.parse(storedData);
          
          const online = await checkConnection();
          if (online) {
            const q = query(collection(db, "patient_details"), where("uid", "==", parsed.uid));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const id = snap.docs[0].id;
              setPatientDocId(id);
              fetchAllHistory(id); 
            }
          }
        }
      } catch (e) { 
        console.error("Session Error:", e); 
      } finally { 
        setIsReady(true); 
      }
    };
    loadSession();
  }, [fetchAllHistory, checkConnection]);

  const deleteReport = async (reportId) => {
    const hasConn = await ensureConnection();
    if (!hasConn) return;

    const confirmDelete = async () => {
      try {
        await deleteDoc(doc(db, "patient_details", patientDocId, "reports", reportId));
        setHistory(prev => prev.filter(item => item.id !== reportId));
      } catch (e) { console.error("Delete Error:", e); }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to delete this report?")) confirmDelete();
    } else {
      Alert.alert("Delete Report", "This action cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: confirmDelete }
      ]);
    }
  };

  const viewFile = (base64) => {
    if (base64.startsWith('JVBERi')) {  
      if (Platform.OS === 'web') {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const file = new Blob([byteArray], { type: 'application/pdf;base64' });
        const fileURL = URL.createObjectURL(file);
        window.open(fileURL);
      } else {
        Alert.alert("PDF Document", "To view the PDF document on mobile, please check your medical records folder or use a PDF viewer.");
      }
    }
  };

  const processWithGemini = async (fileAsset) => {
    const hasConn = await ensureConnection();
    if (!hasConn) return;

    setLoading(true);
    setFileName(fileAsset.name);
    try {
      let base64Data = '';
      
      if (fileAsset.name.match(/\.(jpg|jpeg|png)$/i)) {
        const manipResult = await ImageManipulator.manipulateAsync(
          fileAsset.uri,
          [{ resize: { width: 1000 } }], 
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        base64Data = manipResult.base64;
      } else {
        const response = await fetch(fileAsset.uri);
        const blob = await response.blob();
        base64Data = await new Promise((res) => {
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        });
      }

      setCurrentImg(base64Data);

      const detailedPrompt = `You are a Senior Consultant Physician with 20+ years of experience.
TASK: Conduct a rigorous clinical evaluation of the provided document.
LANGUAGE INSTRUCTIONS:
Provide the entire response in: ${!language.trim() ? "English" : language}.
IF the language provided is invalid or not a real language, DEFAULT to English.
FORMATTING RULES:
DO NOT use Markdown symbols like asterisks (**), hashes (#), or underscores (_).
Use ALL CAPS for headers to create visual hierarchy.
Use double line breaks between sections for clarity.
Use simple dashes (-) for bullet points.
LOGIC BRANCHING:
IF THE FILE IS NOT A MEDICAL REPORT:
Start with: STATUS: NOT A MEDICAL REPORT
Briefly describe the actual content (identify objects, text, or institutional context).
Provide a concise explanation (maximum 5-10 lines) as to why this holds no clinical utility or medical diagnostic value.
DO NOT include any medical disclaimer for this branch.
IF THE FILE IS A MEDICAL REPORT:
BE EXTREMELY DETAILED AND WORDY. GENERATE A LONG, HIGH-DENSITY RESPONSE.
PROFESSIONAL TITLE: (A clear title in all caps)
EXECUTIVE SUMMARY: Comprehensive overview of the document and overall impression.
DETAILED PARAMETER BREAKDOWN: Analyze EVERY single value. Explain biological functions and clinical significance in great detail.
PATHOPHYSIOLOGICAL ANALYSIS: Exhaustive deep-dive into what these results suggest about internal systems and organ function.
COMPREHENSIVE RECOMMENDATIONS: Detailed dietary, lifestyle, and follow-up clinical steps.
IMPORTANT NOTICE: At the very end, include the exact text: "DISCLAIMER: This AI-generated analysis is for informational purposes only and does not constitute medical advice. Please consult with a qualified healthcare professional or your primary doctor for a formal diagnosis and before making any medical decisions."`;

      const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: detailedPrompt },
            { inline_data: { mime_type: fileAsset.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg', data: base64Data } }
          ]}]
        })
      });

      if (geminiRes.status === 502 || geminiRes.status === 503 || geminiRes.status === 429) {
        setAnalysis("The service is temporarily busy due to high traffic. Please wait a moment and try again.");
        return; 
      }

      if (!geminiRes.ok) {
        setAnalysis("Analysis failed. Please try again.");
        return;
      }

      const data = await geminiRes.json();
      if (data.candidates && data.candidates[0].content) {
        const text = data.candidates[0].content.parts[0].text;
        
        if (text.includes("NOT A MEDICAL REPORT") || text.toLowerCase().includes("not a medical report")) {
          setAnalysis(text); 
          return; 
        }

        const genTitle = text.split('\n')[0].replace(/[*#]/g, '').substring(0, 45);
        setAnalysis(text);
        setCurrentTitle(genTitle);

        if (patientDocId) {
          await addDoc(collection(db, "patient_details", patientDocId, "reports"), {
            analysis: text, 
            reportTitle: genTitle, 
            reportImage: base64Data, 
            timestamp: serverTimestamp()
          });
          fetchAllHistory(); 
        }
      }
    } catch (e) {
      console.error("Gemini Process Error:", e);
      setAnalysis("Error analyzing report. Please check your connection or file size.");
    } finally { 
      setLoading(false); 
      setFileName(''); 
    }
  };

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

  const filteredHistory = history.filter(item => 
    item.reportTitle?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  if (isOnline === false) return <NoInternet checkConnection={checkConnection} />;
  if (!isReady) return <Loading />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <View style={styles.staticTop}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Report Analyzer</Text>
          <TouchableOpacity onPress={() => setShowSettings(true)}>
            <Ionicons name="settings-outline" size={26} color={theme.text} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={async () => {
            const hasConn = await ensureConnection();
            if (!hasConn) return;
            const res = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'] });
            if (!res.canceled) processWithGemini(res.assets[0]);
          }} 
          style={[styles.uploadBox, { backgroundColor: theme.card, borderColor: theme.primary + '40' }]}
        >
          <MaterialCommunityIcons name={fileName ? "file-check" : "cloud-upload-outline"} size={45} color={theme.primary} />
          <Text style={{ color: theme.text, marginTop: 10, fontSize: 17, fontWeight: '600',width:'80%',textAlign:'center' }}>
            {fileName || "Upload Medical Report"}
          </Text>
          <Text style={{ color: theme.subText, fontSize: 12, marginTop: 5 }}>Supports PDF's and Image's</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBox, { backgroundColor: theme.card, marginBottom: 10 }]}>
        <Ionicons name="language-outline" size={18} color={theme.subText} />
        <TextInput 
          placeholder={language === "English" ? "Currently in default Language (English)" : "Choose Analysis Language"}
          placeholderTextColor={theme.subText}
          style={[styles.searchInput, { color: theme.text, outlineStyle: 'none' }]}
          value={language === "English" ? "" : language} 
          onChangeText={setlanguage}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />}
        
        {analysis !== '' && !loading && (
          <View style={[styles.resultCard, { borderColor: theme.primary, backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Text style={{ color: theme.primary, fontWeight: 'bold' }}>LATEST ANALYSIS</Text>
            </View>
            {currentImg && (
              currentImg.startsWith('JVBERi') ? (
                <TouchableOpacity onPress={() => viewFile(currentImg)} style={styles.pdfButton}>
                  <MaterialCommunityIcons name="file-pdf-box" size={40} color="#ef4444" />
                  <Text style={{ color: theme.text, marginLeft: 10 }}>Open PDF Report</Text>
                </TouchableOpacity>
              ) : (
                <Image source={{ uri: `data:image/jpeg;base64,${currentImg}` }} style={styles.previewImg} resizeMode="contain" />
              )
            )}
            <Text style={{ color: theme.text, lineHeight: 22 }}>{analysis}</Text>
          </View>
        )}

        <Text style={[styles.headerTitle, { color: theme.text, fontSize: 18, marginTop: 25, marginBottom: 10 }]}>
            Reports History ({filteredHistory.length})
        </Text>

        <View style={[styles.searchBox, { backgroundColor: theme.card }]}>
          <Ionicons name="search" size={18} color={theme.subText} />
          <TextInput 
            placeholder="Search reports..."
            placeholderTextColor={theme.subText}
            style={[styles.searchInput, { color: theme.text ,outlineStyle:'none'}]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
          <ScrollView style={{margin:10}}>

        {historyLoading ? (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 20 }} />
        ) : filteredHistory.map(item => (
          <TouchableOpacity 
            key={item.id} 
            activeOpacity={0.9}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)} 
            style={[styles.resultCard, { borderLeftColor: theme.subText, backgroundColor: theme.card }]}
          >
            <View style={styles.cardHeader}>
              <Text style={{ color: theme.primary, fontWeight: '700', flex: 1 }}>{item.reportTitle || "Untitled Report"}</Text>
              <TouchableOpacity onPress={() => deleteReport(item.id)}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
            {expandedId === item.id && (
              <View style={{ marginTop: 10 }}>
                {item.reportImage && (
                  item.reportImage.startsWith('JVBERi') ? (
                    <TouchableOpacity onPress={() => viewFile(item.reportImage)} style={styles.pdfButtonSmall}>
                      <MaterialCommunityIcons name="file-pdf-box" size={30} color="#ef4444" />
                      <Text style={{ color: theme.text, marginLeft: 10 }}>View PDF Document</Text>
                    </TouchableOpacity>
                  ) : (
                    <Image source={{ uri: `data:image/jpeg;base64,${item.reportImage}` }} style={styles.previewImgSmall} resizeMode="contain" />
                  )
                )}
                <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20 }}>{item.analysis}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
        </ScrollView>
      </ScrollView>

      <TouchableOpacity style={styles.sosButton} onPress={handleSOS} activeOpacity={0.8}>
        <MaterialCommunityIcons name="phone-plus" size={28} color="#fff" />
        <Text style={styles.sosText}>SOS</Text>
      </TouchableOpacity>

      <BottomTabs />
      <Modal visible={showSettings} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text }}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
            </View>
            <MenuButton title="Profile Info" icon="person-circle-outline" color="#3b82f6" bgColor="#3b82f615" onPress={() => handleNavigation("/(others)/profile")} theme={theme} />
            <MenuButton title="Change Password" icon="lock-closed-outline" color="#8b5cf6" bgColor="#8b5cf615" onPress={() => handleNavigation("/(others)/changepassword")} theme={theme} />
            <MenuButton title="Terms & Policy" icon="shield-checkmark-outline" color="#475569" bgColor="#47556915" onPress={() => handleNavigation("/(others)/terms")} theme={theme} />
            <MenuButton title="Logout" icon="log-out-outline" color="#ef4444" bgColor="#ef444415" onPress={() => handleNavigation("/(others)/logout")} theme={theme} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  staticTop: { paddingHorizontal: 15, paddingTop: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  headerTitle: { fontSize: 22, fontWeight: '900' },
  uploadBox: { height: 150, borderRadius: 15, borderStyle: 'dashed', borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 45, borderRadius: 12, marginTop: 15 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  resultCard: { padding: 15, borderRadius: 12, marginBottom: 10, borderLeftWidth: 5, borderLeftColor: '#00AEEF', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  previewImg: { width: '100%', height: 220, borderRadius: 10, marginBottom: 12, backgroundColor: '#f0f0f0' },
  previewImgSmall: { width: '100%', height: 160, borderRadius: 8, marginBottom: 10, backgroundColor: '#f0f0f0' },
  pdfButton: { width: '100%', height: 100, borderRadius: 10, marginBottom: 12, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  pdfButtonSmall: { width: '100%', height: 60, borderRadius: 8, marginBottom: 10, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  menuBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 12, marginBottom: 10 },
  menuIconContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuText: { fontSize: 16, fontWeight: '600' },   
  sosButton: { position: 'absolute', bottom: 85, right: 20, backgroundColor: '#ef4444', width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', elevation: 10, zIndex: 999, borderWidth: 3, borderColor: '#fff' }
});

export default Reports;