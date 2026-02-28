import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  useColorScheme, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import NetInfo from "@react-native-community/netinfo";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../doctorauthentication/firebase'; 
import { themes } from '../../constants/themes'; 

import Loading from "../components/loading"; 
import NoInternet from "../components/nointernet";
import ServerError from "../components/servererror";

const ChangePassword = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = themes[colorScheme] ?? themes.light;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const [isOnline, setIsOnline] = useState(null);
  const [serverError, setServerError] = useState(false);

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

  const handleUpdate = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showNotify("Error", "Please fill in all fields.");
      return;
    }

    if (newPassword === currentPassword) {
      showNotify("Same Password", "The new password cannot be the same as your current password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      showNotify("Mismatch", "New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      showNotify("Too Short", "New password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setServerError(false);

    const online = await checkConnection();
    if (!online) {
      setLoading(false);
      return;
    }

    try {
      const user = auth.currentUser;

      if (user && user.email) {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        
        await updatePassword(user, newPassword);
        
        showNotify("Done", "Success! Your password has been updated.");
        router.back();
      } else {
        throw new Error("Session expired. Please log in again.");
      }
    } catch (error) {
      console.error(error);
      let errorMsg = "Failed to update password.";
      
      if (error.code === 'auth/wrong-password') {
        errorMsg = "The current password you entered is incorrect.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMsg = "Too many failed attempts. Please try again later.";
      } else if (error.code === 'auth/requires-recent-login') {
        errorMsg = "For security, please log out and log back in before changing your password.";
      }

      showNotify("Security", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const showNotify = (title, msg) => {
    Platform.OS === 'web' ? window.alert(`${title}: ${msg}`) : Alert.alert(title, msg);
  };

  const platformInputStyle = [
    styles.input, 
    { color: theme.text }, 
    Platform.OS === 'web' && { outlineStyle: 'none' }
  ];

  if (isOnline === null) return <Loading />;
  if (isOnline === false) return <NoInternet checkConnection={checkConnection} />;
  if (serverError) return <ServerError onRetry={handleUpdate} />;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.iconHeader, { backgroundColor: theme.primary + '1A' }]}>
          <Ionicons name="shield-checkmark" size={42} color={theme.primary} />
        </View>

        <Text style={[styles.title, { color: theme.text }]}>Security Update</Text>
        <Text style={[styles.subtitle, { color: theme.subText }]}>
         Update your security credentials to keep your medical records secure.
        </Text>

        <View style={styles.inputWrapper}>
          <Text style={[styles.label, { color: theme.text }]}>Current Password</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.subText} style={{ marginRight: 10 }} />
            <TextInput
              style={platformInputStyle}
              placeholder="••••••••"
              placeholderTextColor={theme.subText}
              secureTextEntry={!showPwd}
 importantForAutofill="no"  
           textContentType="none"
           autoComplete="off"
            importantForAccessibility="no-hide-descendants"
                          value={currentPassword}
              onChangeText={setCurrentPassword}
              underlineColorAndroid="transparent"
            />
            <TouchableOpacity onPress={() => setShowPwd(!showPwd)}>
              <Ionicons name={showPwd ? "eye-off" : "eye"} size={20} color={theme.subText} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.inputWrapper}>
          <Text style={[styles.label, { color: theme.text }]}>New Password</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="key-outline" size={20} color={theme.subText} style={{ marginRight: 10 }} />
            <TextInput
              style={platformInputStyle}
              placeholder="At least 8 characters"
              placeholderTextColor={theme.subText}
              secureTextEntry={!showPwd}
 importantForAutofill="no"  
           textContentType="none"
           autoComplete="off"
            importantForAccessibility="no-hide-descendants"
                          value={newPassword}
              onChangeText={setNewPassword}
              underlineColorAndroid="transparent"
            />
          </View>
        </View>

        <View style={styles.inputWrapper}>
          <Text style={[styles.label, { color: theme.text }]}>Confirm New Password</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="refresh-outline" size={20} color={theme.subText} style={{ marginRight: 10 }} />
            <TextInput
              style={platformInputStyle}
              placeholder="Repeat new password"
              placeholderTextColor={theme.subText}
              secureTextEntry={!showPwd}
 importantForAutofill="no"  
           textContentType="none"
           autoComplete="off"
            importantForAccessibility="no-hide-descendants"
                          value={confirmPassword}
              onChangeText={setConfirmPassword}
              underlineColorAndroid="transparent"
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.submitBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
          onPress={handleUpdate}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Save New Password</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 25, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  iconHeader: { 
    width: 90, 
    height: 90, 
    borderRadius: 25, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 20,
    transform: [{ rotate: '-10deg' }] 
  },
  title: { fontSize: 28, fontWeight: '900', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { textAlign: 'center', fontSize: 15, marginBottom: 35, lineHeight: 22, opacity: 0.8 },
  inputWrapper: { width: '100%', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 10, marginLeft: 4 },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1.5, 
    borderRadius: 18, 
    paddingHorizontal: 15, 
    height: 62,
  },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  divider: { height: 1.5, width: '40%', marginVertical: 20, opacity: 0.3, borderRadius: 1 },
  submitBtn: { 
    width: '100%', 
    height: 60, 
    borderRadius: 18, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 20,
    elevation: 4,
  },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});

export default ChangePassword;