import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Platform, Alert, ScrollView 
} from "react-native";
import React, { useState, useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { themes } from "../constants/themes";
import { useRouter } from "expo-router";
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { signInWithEmailAndPassword, signOut, sendEmailVerification,sendPasswordResetEmail } from "firebase/auth"; 
import { collection, query, where, getDocs } from "firebase/firestore"; 
import { auth, db } from "../doctorauthentication/firebase";
import Loading from "./components/loading";
import NoInternet from "./components/nointernet";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

const patientLogin = () => {
  const colorScheme = useColorScheme();
  const theme = themes[colorScheme] ?? themes.light;
  const [isselected, setisselected] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isOnline, setIsOnline] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();

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
// ... existing useEffect for connection ...

useEffect(() => {
  const loadSavedEmail = async () => {
    try {
      // This looks into the phone/browser storage for the key we saved
      const savedEmail = await AsyncStorage.getItem('rememberedEmail');
      
      // If it exists, fill the email box and check the box automatically
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (e) {
      console.error("Failed to load remembered email", e);
    }
  };
  loadSavedEmail();
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

  async function verifylogin() {
    const online = await checkConnection();
    if (!online) return;

    if (!email.trim() || !password) {
      const msg = "Please enter your credentials.";
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert("Input Required", msg);
      return;
    }

    setIsVerifying(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      let user = userCredential.user;
      
      await user.reload();
      user = auth.currentUser; 

      if (!user.emailVerified) {
        await sendEmailVerification(user);
        await signOut(auth); 
        setIsVerifying(false);
        const vMsg = "Please verify your email address before logging in.";
        Platform.OS === 'web' ? window.alert(vMsg) : Alert.alert("Verification Needed", vMsg);
        return; 
      }

      const q = query(collection(db, "patient_details"), where("uid", "==", user.uid));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        const sessionData = {
          uid: user.uid
        };
        if (rememberMe) {
          await AsyncStorage.setItem('rememberedEmail', email.trim());
        } else {
          await AsyncStorage.removeItem('rememberedEmail');
        }
        await AsyncStorage.setItem('patientSession', JSON.stringify(sessionData));
        setIsVerifying(false);
        router.replace("/home");
      } else {
        await signOut(auth);
        setIsVerifying(false);
        const authMsg = "Patient record not found for this account.";
        Platform.OS === 'web' ? window.alert(authMsg) : Alert.alert("Unauthorized", authMsg);
      }
    } catch (error) {
      setIsVerifying(false);
      let errorMsg = "Invalid email or password. Please try again.";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        errorMsg = "Incorrect credentials. Please check your email and password.";
      }
      Platform.OS === 'web' ? window.alert(errorMsg) : Alert.alert("Login Failed", errorMsg);
    }
  }

  const forgotPassword = async () => {
    const online = await checkConnection();
    if (!online) return;

    if (!email.trim()) {
      const msg = "Please enter your email address to reset your password.";
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert("Input Required", msg);
      return;
    }

    setIsVerifying(true);
    try {
      auth.languageCode = "en"; 
      await sendPasswordResetEmail(auth, email.trim());
      
      setIsVerifying(false);
      
      const successMsg = "A password reset link has been sent to your email address.";
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert("Email Sent", successMsg);
      }
    } catch (error) {
      setIsVerifying(false);
      let errorMsg = "Could not send reset email. Please try again.";
      
      if (error.code === 'auth/user-not-found') {
        errorMsg = "No account found with this email address.";
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = "Please enter a valid email address.";
      }

      Platform.OS === 'web' ? window.alert(errorMsg) : Alert.alert("Error", errorMsg);
    }
  };
   
  if (isOnline === null || isVerifying) return <Loading />;
  if (isOnline === false) return <NoInternet checkConnection={checkConnection} />;

  const activeStyles = Platform.OS === "web" ? styles.webstyle : styles.mobilestyle;

  return (
    <View style={[activeStyles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <ScrollView 
        contentContainerStyle={activeStyles.scrollContainer} 
        showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
      >
        <View style={activeStyles.card}>
          <View style={[activeStyles.iconBox, { backgroundColor: theme.primary + '20' }]}>
            <Ionicons name="person" size={35} color={theme.primary} />
          </View>

          <View style={activeStyles.titleSection}>
            <Text style={[activeStyles.title, { color: theme.text }]}>Patient Login</Text>
            <Text style={[activeStyles.subtitle, { color: theme.subText }]}>Secure Patient Access</Text>
          </View>

          <View style={activeStyles.formContainer}>
            <View style={activeStyles.inputWrapper}>
              <Text style={[activeStyles.inputLabel, { color: theme.text }]}>Email</Text>
              <View style={[activeStyles.passwordBox, { 
                  borderColor: isselected === 'email' ? theme.primary : theme.border, 
                  backgroundColor: theme.card,
              }]}>
                <TextInput
                  placeholder="User Email"
                  placeholderTextColor={theme.subText + '80'}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  underlineColorAndroid="transparent"
                  style={[activeStyles.passwordInput, { 
                      color: theme.text,
                      ...(Platform.OS === 'web' ? { outlineStyle: "none" } : {})
                  }]}
                  onFocus={() => setisselected('email')}
                  onBlur={() => setisselected('')}
                />
              </View>
            </View>

<Text style={[activeStyles.inputLabel, { color: theme.text, marginTop: 15 }]}>Password</Text>
            <View style={[activeStyles.passwordBox, { 
                borderColor: isselected === 'pass' ? theme.primary : theme.border, 
                backgroundColor: theme.card,
                marginTop: 5 
            }]}>
              <TextInput
                placeholder="Security Password"
                placeholderTextColor={theme.subText + '80'}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                underlineColorAndroid="transparent"
                style={[activeStyles.passwordInput, { color: theme.text, ...(Platform.OS === 'web' ? { outlineStyle: "none" } : {})}]}
                onFocus={() => setisselected('pass')}
                onBlur={() => setisselected('')}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={activeStyles.eyeIcon}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={22} color={theme.subText} />
              </TouchableOpacity>
            </View>
    

<View style={{ width: '100%', alignItems: 'center', marginBottom: 10 }}>
  <TouchableOpacity 
    style={{ 
      flexDirection: 'row', 
      alignItems: 'center', 
      paddingVertical: 10,
      paddingHorizontal: 5,
      cursor: Platform.OS === 'web' ? 'pointer' : 'default' // Better UX for web
    }}
    onPress={() => setRememberMe(!rememberMe)}
  >
    <Ionicons 
      name={rememberMe ? "checkbox" : "square-outline"} 
      size={Platform.OS === 'web' ? 22 : 20} 
      color={rememberMe ? theme.primary : theme.subText} 
    />
    <Text style={{ 
      color: theme.text, 
      marginLeft: 10, 
      fontSize: Platform.OS === 'web' ? 16 : 14, 
      fontWeight: "500" 
    }}>
      Remember my email
    </Text>
  </TouchableOpacity>
</View>



<TouchableOpacity style={{ alignSelf: 'center', marginTop: 10 }} onPress={forgotPassword}>
  <Text style={[{ color: theme.primary, fontSize:14, fontWeight:"600"}]}>Forgot Password?</Text>
</TouchableOpacity>
            <TouchableOpacity 
                style={[activeStyles.loginBtn, { backgroundColor: theme.primary }]} 
                onPress={verifylogin}
                activeOpacity={0.8}
            >
              <Text style={activeStyles.loginText}>Authenticate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  mobilestyle: {
    container: { flex: 1 },
    scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: '8%' },
    card: { width: '100%', alignItems: 'center' },
    iconBox: { height: 75, width: 75, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 20 },
    titleSection: { alignItems: 'center', marginBottom: 35 },
    title: { fontSize: 28, fontWeight: "900", textAlign: 'center' },
    subtitle: { fontSize: 15, fontWeight: "500", marginTop: 5, textAlign: 'center' },
    formContainer: { width: '100%' },
    inputWrapper: { width: '100%' },
    inputLabel: { fontSize: 14, paddingBottom: 5, paddingLeft: 10, fontWeight: "600" },
    passwordBox: { height: 58, flexDirection: "row", alignItems: "center", borderRadius: 16, paddingHorizontal: 18, borderWidth: 1.5 },
    passwordInput: { flex: 1, fontSize: 16 },
    eyeIcon: { padding: 5 },
    loginBtn: { height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", marginTop: 20 },
    loginText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  },
  webstyle: {
    container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
    card: { 
      width: '100%', 
      maxWidth: 450, 
      alignItems: 'center', 
      padding: 40, 
      borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.03)', 
    },
    iconBox: { height: 80, width: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 25 },
    titleSection: { alignItems: 'center', marginBottom: 45 },
    title: { fontSize: 38, fontWeight: "900", textAlign: 'center' },
    subtitle: { fontSize: 18, fontWeight: "500", textAlign: 'center' },
    formContainer: { width: '100%' },
    inputWrapper: { width: '100%' },
    inputLabel: { fontSize: 14, marginBottom: 8, paddingLeft: 4, fontWeight: "600" },
    passwordBox: { height: 60, flexDirection: "row", alignItems: "center", borderRadius: 18, paddingHorizontal: 20, borderWidth: 2 },
    passwordInput: { flex: 1, fontSize: 16 },
    eyeIcon: { padding: 5 },
    loginBtn: { height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center", marginTop: 25 },
    loginText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  }
});

export default patientLogin;