import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, Platform, 
  useColorScheme, TouchableOpacity, ScrollView, Dimensions,Alert,
  AppState, Animated, Vibration, Modal, TextInput ,Linking
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import NetInfo from "@react-native-community/netinfo";
import { themes } from "../constants/themes";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import LottieView from 'lottie-react-native';
import { Pedometer } from 'expo-sensors'; 
import * as Location from 'expo-location';
import { db } from '../doctorauthentication/firebase'; 
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

import Loading from "./components/loading"; 
import NoInternet from "./components/nointernet";
import BottomTabs from './components/tabs';

const { width, height } = Dimensions.get('window');
const DAILY_TARGET = 3700; 
const STEP_TARGET = 10000; 

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const Home = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = themes[colorScheme] ?? themes.light;
  const confettiRef = useRef(null);

  const [isOnline, setIsOnline] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [patientData, setPatientData] = useState(null);
  const [docId, setDocId] = useState(null);
  const [waterAmount, setWaterAmount] = useState(0);
  const [stepCount, setStepCount] = useState(0); 
  const [selectedStatus, setSelectedStatus] = useState(null);
const [weatherData, setWeatherData] = useState(null);
const [weatherSuggestion, setWeatherSuggestion] = useState("");
  const [healthTip, setHealthTip] = useState("Fetching your daily health insight...");
  const [isTipLoading, setIsTipLoading] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;

  const [isBreathing, setIsBreathing] = useState(false);
  const [breathText, setBreathText] = useState("Ready?");
  const [timeLeft, setTimeLeft] = useState(0);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const breathAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);
  const isBreathingRef = useRef(false); 
  const [showSettings, setShowSettings] = useState(false);
const getAQIStatus = (aqi) => {
  switch (aqi) {
    case 1: return { label: "Excellent", color: "#10b981" };
    case 2: return { label: "Good", color: "#84cc16" };
    case 3: return { label: "Moderate", color: "#f59e0b" };
    case 4: return { label: "Poor", color: "#f97316" };
    case 5: return { label: "Hazardous", color: "#ef4444" };
    default: return { label: "Unknown", color: "#6b7280" };
  }
};
const fetchWeather = async () => {
  const API_KEY = 'c690e6f1896f71fc72cb459be466e70b';
  
  try {
    let { status } = await Location.requestForegroundPermissionsAsync();
    
    let lat, lon, cityName = "Your Area";
    let wData; 

    if (status === 'granted') {
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      lat = location.coords.latitude;
      lon = location.coords.longitude;
      
      const wRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`);
      wData = await wRes.json(); 
      cityName = wData.name;
    } else {
      const fallbackRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=Hyderabad&units=metric&appid=${API_KEY}`);
      wData = await fallbackRes.json();
      lat = wData.coord.lat;
      lon = wData.coord.lon;
      cityName = "Hyderabad (Default)";
    }

    const pRes = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
    const pData = await pRes.json();
    
const aqi = pData?.list?.[0]?.main?.aqi || 1; 
    const combinedData = {
      temp: Math.round(wData?.main?.temp || 0),
      humidity: wData?.main?.humidity || 0,
      aqi: aqi,
      condition: wData?.weather[0]?.main || "Clear",
      city: cityName 
    };

    setWeatherData(combinedData);
    generateWeatherSuggestion(combinedData);
  } catch (e) {
    console.log("Weather/Location Error:", e);
  }
};
const generateWeatherSuggestion = (data) => {
  let suggestion = "";
  if (data.aqi >= 4) suggestion = "Poor air quality. Stay indoors and use a mask if you must go out.";
  else if (data.temp > 30) suggestion = "It's quite hot! Increase your water intake and avoid direct sun.";
  else if (data.temp < 10) suggestion = "Chilly weather. Keep warm to prevent joint stiffness or colds.";
  else if (data.humidity > 80) suggestion = "High humidity today. Stay in well-ventilated areas.";
  else suggestion = "Weather is pleasant. Great time for a light walk!";
  
  setWeatherSuggestion(suggestion);
};

  const startBreathing = (minutes) => {
    const seconds = minutes * 60;
    setTimeLeft(seconds);
    setIsBreathing(true);
    isBreathingRef.current = true;
    runBreathCycle();
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopBreathing();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const runBreathCycle = () => {
    if (!isBreathingRef.current) return; 

    setBreathText("Inhale...");
    if (Platform.OS !== 'web') Vibration.vibrate(100);
    
    Animated.timing(breathAnim, {
      toValue: 1.5,
      duration: 6000,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && isBreathingRef.current) {
        setBreathText("Exhale...");
        if (Platform.OS !== 'web') Vibration.vibrate(50);

        Animated.timing(breathAnim, {
          toValue: 1,
          duration: 6000,
          useNativeDriver: true,
        }).start(({ finished: cycleFinished }) => {
          if (cycleFinished && isBreathingRef.current) {
            runBreathCycle();
          }
        });
      }
    });
  };

  const stopBreathing = () => {
    setIsBreathing(false);
    isBreathingRef.current = false;
    setBreathText("Ready?");
    if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
    }
    breathAnim.stopAnimation();
    Animated.spring(breathAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const statusOptions = [
    { 
        label: 'Great', 
        icon: 'smile-beam', 
        color: '#10b981',
        advice: "Awesome! Maintain this momentum. Try to get 30 mins of light movement today.",
        tip: "Perfect time for a walk!" 
    },
    { 
        label: 'Tired', 
        icon: 'bed', 
        color: '#f59e0b',
        advice: "Your body needs rest. Aim for 8 hours of sleep and avoid screens 1 hour before bed.",
        tip: "Limit caffeine now." 
    },
    { 
        label: 'In Pain', 
        icon: 'frown-open', 
        color: '#ef4444',
        advice: "Avoid heavy lifting. If pain persists above level 6, message your doctor immediately. In case of severe pain, click the SOS button to contact emergency services.",
        tip: "Try a warm compress." 
    },
    { 
        label: 'Recovering', 
        icon: 'medkit', 
        color: '#3b82f6',
        advice: "Healing takes time. Stick to your prescribed meds and stay hydrated.",
        tip: "Keep the area clean." 
    },
  ];

  const fetchHealthTip = async () => {
    setIsTipLoading(true);
    Animated.timing(spinValue, { toValue: 1, duration: 600, useNativeDriver: true }).start(() => spinValue.setValue(0));
    try {
      const response = await fetch(`https://api.adviceslip.com/advice?t=${Date.now()}`);
      const data = await response.json();
      if (data && data.slip) {
        setHealthTip(data.slip.advice);
      } else {
        throw new Error("Invalid data format");
      }
    } catch (e) {
      console.log("API Error:", e);
      setHealthTip("Stay consistent with your hydration and daily step goals for a faster recovery.");
    } finally {
      setIsTipLoading(false);
    }
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const updateStepsInDb = async (total) => {
    if (!docId) return;
    try {
      await updateDoc(doc(db, "patient_details", docId), {
        steps: total,
        lastStepUpdate: new Date()
      });
    } catch (e) { console.log("Step Sync Error:", e); }
  };

  const subscribeSteps = async () => {
    const isAvailable = await Pedometer.isAvailableAsync();
    if (isAvailable) {
      const end = new Date();
      const start = new Date();
      start.setHours(0, 0, 0, 0); 
      const pastResult = await Pedometer.getStepCountAsync(start, end);
      const baseline = pastResult ? pastResult.steps : 0;
      setStepCount(baseline);
      updateStepsInDb(baseline);
      return Pedometer.watchStepCount(result => {
        const totalNow = baseline + result.steps;
        setStepCount(prev => {
            if (totalNow >= STEP_TARGET && prev < STEP_TARGET) {
                confettiRef.current?.play(0);
            }
            return totalNow;
        });
        updateStepsInDb(totalNow);
      });
    }
  };

  const checkweb = async () => {
    try {
      await fetch("https://8.8.8.8", { mode: 'no-cors', cache: 'no-store' });
      return true;
    } catch { return false; }
  };

  const checkConnection = useCallback(async () => {
    const state = await NetInfo.fetch();
    let status = state.isConnected === true;
    if (status) status = await checkweb();
    setIsOnline(status);
  }, []);

  const setupNotifications = async () => {
    if (Platform.OS === 'web') return;
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        await Notifications.cancelAllScheduledNotificationsAsync();
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Hydration Alert 💧",
            body: `Goal: ${DAILY_TARGET}ml. Stay hydrated!`,
          },
          trigger: { seconds: 3 * 60 * 60, repeats: true },
        });
      }
    } catch (e) { console.log(e); }
  };
const [streak, setStreak] = useState(1);

const updateStreak = async (dId, currentData) => {
  const today = new Date().toDateString();
  const lastLoginDate = currentData.lastLoginDate ? new Date(currentData.lastLoginDate.seconds * 1000).toDateString() : null;

  if (lastLoginDate === today) return;

  let newStreak = 1;
  if (lastLoginDate) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (lastLoginDate === yesterday.toDateString()) {
      newStreak = (currentData.streak || 0) + 1;
    }
  }

  setStreak(newStreak);
  try {
    await updateDoc(doc(db, "patient_details", dId), {
      streak: newStreak,
      lastLoginDate: new Date()
    });
  } catch (e) { console.log("Streak Update Error:", e); }
};


  const fetchPatientData = async () => {
    try {
      const storedData = await AsyncStorage.getItem('patientSession');
      if (!storedData) { router.replace("/patientlogin"); return; }
      const { uid } = JSON.parse(storedData);
      const q = query(collection(db, "patient_details"), where("uid", "==", uid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        const dId = snap.docs[0].id;
        updateStreak(dId, data);
        setDocId(dId);
        setPatientData(data);
        setWaterAmount(data.water || 0);
        setSelectedStatus(data.dailyStatus || null);
      }
    } catch (e) { console.error(e); } finally { setIsReady(true); }
  };

  useEffect(() => {
    let stepSubscription;
    const init = async () => {
      await checkConnection();
      fetchWeather();
      await fetchPatientData();
      await setupNotifications();
      stepSubscription = await subscribeSteps();
      fetchHealthTip();
    };
    init();
    const appStateSub = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') { subscribeSteps(); }
    });
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      let online = state.isConnected === true;
      if (online) online = await checkweb();
      setIsOnline(online);
    });
    return () => {
        unsubscribe();
        appStateSub.remove();
        if (stepSubscription && typeof stepSubscription.remove === 'function') stepSubscription.remove();
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [checkConnection]);

  const addWater = async (ml) => {
    if (!docId) return;
    const newTotal = waterAmount + ml;
    if (newTotal >= DAILY_TARGET && waterAmount < DAILY_TARGET) {
      confettiRef.current?.play(0);
    }
    setWaterAmount(newTotal);
    try {
      await updateDoc(doc(db, "patient_details", docId), {
        water: newTotal,
        lastWaterUpdate: new Date()
      });
    } catch (e) { console.log(e); }
  };

  const saveStatus = async (status) => {
    if (!docId) return;
    setSelectedStatus(status);
    try {
      await updateDoc(doc(db, "patient_details", docId), {
        dailyStatus: status,
        lastStatusUpdate: new Date()
      });
    } catch (e) { console.log(e); }
  };

  const waterProgress = Math.min((waterAmount / DAILY_TARGET) * 100, 100);
  const stepProgress = Math.min((stepCount / STEP_TARGET) * 100, 100);
  const currentStatusObj = statusOptions.find(o => o.label === selectedStatus);

  const getStepMotivation = (progress) => {
    if (progress >= 100) return "🏁 Goal Reached! You're unstoppable!";
    if (progress >= 70) return "🔥 Almost there! Keep that pace up!";
    if (progress >= 50) return "🚶 Halfway! Great momentum today!";
    if (progress >= 25) return "👟 Solid start! Every step counts!";
    return "⚡ Let's get moving! You can do this!";
  };

  const getWaterMotivation = (progress) => {
    if (progress >= 100) return "🌊 Fully Hydrated! Your body says thanks!";
    if (progress >= 70) return "💧 Nearly hit your goal! One more glass?";
    if (progress >= 50) return "🥤 50% reached! Keep sipping away!";
    if (progress >= 25) return "🌱 Good progress! Stay consistent!";
    return "🥛 Time for some water. Your cells need it!";
  };
const getStreakMessage = (count) => {
  if (count >= 30) return "Living legend! 🏆 Your discipline is unmatched.";
  if (count >= 14) return "Two weeks strong! 🎯 You've built a real habit.";
  if (count >= 7) return "Full week completed! 🌟 You're on a roll.";
  if (count >= 3) return "Three day streak! 🔥 You're heating up.";
  if (count > 1) return "Keep it going! 👟 Consistency is key.";
  return "Day 1 starts now! 🌱 Let's begin the journey.";
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







const openNearbyHospitals = async () => {
  const query = "Hospitals nearby";
  const webUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  const mobileUrl = Platform.OS === 'ios' 
    ? `maps:0,0?q=${query}` 
    : `geo:0,0?q=${query}`;

  try {
    if (Platform.OS === 'web') {
      window.open(webUrl, '_blank');
    } else {
      const supported = await Linking.canOpenURL(mobileUrl);
      if (supported) {
        await Linking.openURL(mobileUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    }
  } catch (error) {
    alert("Could not open Maps automatically.");
  }
};



  if (!isReady) return <Loading />;
  if (isOnline === false) return <NoInternet checkConnection={checkConnection} />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      
      <View style={styles.lottieOverlay} pointerEvents="none">
        <LottieView
          ref={confettiRef}
          source={require('../assets/confetti.json')}
          autoPlay={false}
          loop={false}
          style={{ width: width, height: height }}
        />
      </View>

        
        <View style={[styles.header, { paddingHorizontal: 20 }, { backgroundColor: theme.card },{height:80,marginTop:0}]}>
          <View>
            <Text style={[styles.name, { color: theme.subText }]}>Patient Portal</Text>
          </View>
<TouchableOpacity onPress={() => setShowSettings(true)} >
            <Ionicons name="settings-outline" size={26} color={theme.text} />
          </TouchableOpacity>
        </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={[styles.tipCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.tipHeader}>
            <View style={styles.tipTitleRow}>
              <MaterialCommunityIcons name="auto-fix" size={20} color={theme.primary} />
              <Text style={[styles.tipTitle, { color: theme.text }]}>Random Advice</Text>
            </View>
            <TouchableOpacity onPress={fetchHealthTip} disabled={isTipLoading}>
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons name="refresh" size={20} color={theme.primary} />
              </Animated.View>
            </TouchableOpacity>
          </View>
          <Text style={[styles.tipContent, { color: theme.subText, opacity: isTipLoading ? 0.5 : 1 }]}>
            {healthTip}
          </Text>
        </View>
<View style={[styles.streakContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
  <MaterialCommunityIcons 
    name={streak >= 7 ? "fire-circle" : "fire"} 
    size={28} 
    color={streak >= 7 ? "#ef4444" : "#f97316"} 
  />
  <View style={styles.streakTextContainer}>
    <Text style={[styles.streakNumber, { color: theme.text }]}>{streak} Day Streak</Text>
    <Text style={[styles.streakSubtext, { color: theme.subText }]}>
      {getStreakMessage(streak)}
    </Text>
  </View>
</View>
{weatherData && (
  <View style={[styles.weatherCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
    <View style={styles.weatherHeader}>
      <View style={{ backgroundColor: '#3b82f615', padding: 6, borderRadius: 8 }}>
        <Ionicons name="cloudy-night" size={20} color="#3b82f6" />
      </View>
      <Text style={[styles.cardTitle, { color: theme.text, marginLeft: 10 }]}>
        {weatherData.city || 'Environment'} Sync
      </Text>
    </View>

    <View style={styles.weatherGrid}>
      <View style={styles.weatherItem}>
        <Text style={[styles.weatherVal, { color: theme.text }]}>{weatherData.temp}°C</Text>
        <Text style={[styles.weatherLab, { color: theme.subText }]}>Temp</Text>
      </View>

      <View style={[styles.weatherVerticalDivider, { backgroundColor: theme.border }]} />

      <View style={styles.weatherItem}>
        <Text style={[styles.weatherVal, { color: theme.text }]}>{weatherData.humidity}%</Text>
        <Text style={[styles.weatherLab, { color: theme.subText }]}>Humidity</Text>
      </View>

      <View style={[styles.weatherVerticalDivider, { backgroundColor: theme.border }]} />

<View style={styles.weatherItem}>
  <Text style={[styles.weatherVal, { color: getAQIStatus(weatherData.aqi).color }]}>
    {getAQIStatus(weatherData.aqi).label}
  </Text>
  <Text style={[styles.weatherLab, { color: theme.subText }]}>Air Quality</Text>
</View>
    </View>

    <View style={[styles.weatherSuggestBox, { backgroundColor: theme.primary + '15' }]}>
      <Ionicons name="information-circle" size={16} color={theme.primary} />
      <Text style={[styles.weatherSuggestTxt, { color: theme.text }]}>
        {weatherSuggestion}
      </Text>
    </View>
  </View>
)}
        <View style={[styles.breathCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
           <View style={styles.breathHeader}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <MaterialCommunityIcons name="weather-windy" size={22} color="#8b5cf6" />
                <Text style={[styles.breathTitle, { color: theme.text }]}>Mindful Breathing</Text>
              </View>
              {isBreathing && <Text style={{color: '#8b5cf6', fontWeight: '800'}}>{formatTime(timeLeft)}</Text>}
           </View>
           
           <View style={styles.breathContainer}>
              <Animated.View 
                style={[
                  styles.breathCircle, 
                  { 
                    transform: [{ scale: breathAnim }],
                    backgroundColor: isBreathing ? '#8b5cf630' : theme.border 
                  }
                ]} 
              />
              <Text style={[styles.breathStatus, { color: theme.text }]}>{breathText}</Text>
           </View>

           {isBreathing ? (
             <TouchableOpacity onPress={stopBreathing} style={[styles.breathBtn, { backgroundColor: '#ef4444' }]}>
               <Text style={styles.breathBtnText}>Stop Session</Text>
             </TouchableOpacity>
           ) : (
             <View>
               <View style={styles.breathOptionsRow}>
                 {[3, 5, 10].map(mins => (
                   <TouchableOpacity key={mins} onPress={() => startBreathing(mins)} style={[styles.timeOption, {borderColor: theme.border}]}>
                     <Text style={[styles.timeOptionText, {color: theme.text}]}>{mins}m</Text>
                   </TouchableOpacity>
                 ))}
                 <TouchableOpacity onPress={() => setShowCustomModal(true)} style={[styles.timeOption, {borderColor: theme.primary, borderStyle: 'dashed'}]}>
                    <Ionicons name="add" size={18} color={theme.primary} />
                 </TouchableOpacity>
               </View>
               <Text style={[styles.breathSub, {color: theme.subText}]}>Select duration to start</Text>
             </View>
           )}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Daily Check-in</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusScroll}>
          {statusOptions.map((item) => (
            <TouchableOpacity 
              key={item.label}
              onPress={() => saveStatus(item.label)}
              style={[
                styles.statusCard, 
                { backgroundColor: theme.card, borderColor: selectedStatus === item.label ? item.color : theme.border }
              ]}
            >
              <FontAwesome5 name={item.icon} size={20} color={selectedStatus === item.label ? item.color : theme.subText} />
              <Text style={[styles.statusLabel, { color: selectedStatus === item.label ? item.color : theme.text }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selectedStatus && (
          <View style={[styles.adviceCard, { backgroundColor: currentStatusObj.color + '15', borderColor: currentStatusObj.color }]}>
            <View style={styles.adviceHeader}>
              <Ionicons name="bulb" size={20} color={currentStatusObj.color} />
              <Text style={[styles.adviceTitle, { color: currentStatusObj.color }]}>Recommendation</Text>
            </View>
            <Text style={[styles.adviceText, { color: theme.text }]}>{currentStatusObj.advice}</Text>
            <View style={[styles.tipBadge, { backgroundColor: currentStatusObj.color }]}>
                <Text style={styles.tipText}>{currentStatusObj.tip}</Text>
            </View>
          </View>
        )}

        <View style={[styles.stepCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.stepTopRow}>
            <View style={[styles.stepIconBg, { backgroundColor: '#10b98120' }]}>
              <MaterialCommunityIcons name="run-fast" size={26} color="#10b981" />
            </View>
            <View style={styles.stepTitleContainer}>
              <Text style={[styles.stepMainTitle, { color: theme.text }]}>Daily Activity</Text>
              <View style={styles.goalBadge}>
                <Text style={styles.goalBadgeText}>GOAL: {STEP_TARGET}</Text>
              </View>
            </View>
            <View style={styles.stepStatsContainer}>
               <Text style={[styles.stepBigNumber, { color: theme.text }]}>{stepCount.toLocaleString()}</Text>
               <Text style={[styles.stepSubLabel, { color: theme.subText }]}>STEPS</Text>
            </View>
          </View>

          <View style={[styles.stepProgressContainer, { backgroundColor: theme.border }]}>
            <View 
              style={[
                styles.stepProgressFill, 
                { 
                  width: `${stepProgress}%`, 
                  backgroundColor: stepCount >= STEP_TARGET ? '#fbbf24' : '#10b981',
                  shadowColor: stepCount >= STEP_TARGET ? '#fbbf24' : '#10b981',
                  shadowOpacity: 0.5,
                  shadowRadius: 10,
                  elevation: 5
                }
              ]} 
            />
          </View>

          <View style={styles.stepFooter}>
            <View style={styles.footerItem}>
              <Ionicons name="flame" size={14} color="#f59e0b" />
              <Text style={[styles.footerText, { color: theme.subText }]}> 
                {(stepCount * 0.04).toFixed(1)} kcal
              </Text>
            </View>
            <View style={styles.footerItem}>
              <Ionicons name="location" size={14} color="#3b82f6" />
              <Text style={[styles.footerText, { color: theme.subText }]}> 
                {(stepCount * 0.0008).toFixed(2)} km
              </Text>
            </View>
            <Text style={[styles.goalStatus, { color: stepCount >= STEP_TARGET ? '#fbbf24' : theme.primary }]}>
              {stepCount >= STEP_TARGET ? "👑 CHAMPION" : `${Math.round(stepProgress)}% DONE`}
            </Text>
          </View>
          <Text style={[styles.motivationTxt, { color: theme.primary }]}>
            {getStepMotivation(stepProgress)}
          </Text>
        </View>

        <View style={[styles.waterCard, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 10 }]}>
          <View style={styles.waterHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#3b82f615' }]}>
              <MaterialCommunityIcons name="water" size={28} color="#3b82f6" />
            </View>
            <View style={{flex: 1, marginLeft: 12}}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Hydration Protocol</Text>
              <Text style={{ color: theme.subText, fontSize: 12 }}>Target: {DAILY_TARGET}ml</Text>
            </View>
            <Text style={[styles.waterAmountText, { color: theme.text }]}>{waterAmount}ml</Text>
          </View>

          <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
            <View style={[styles.progressBarFill, { width: `${waterProgress}%`, backgroundColor: '#3b82f6' }]} />
          </View>

          <View style={styles.waterActions}>
            {[150, 250, 500].map(amt => (
              <TouchableOpacity key={amt} onPress={() => addWater(amt)} style={styles.waterBtn}>
                <Text style={styles.waterBtnText}>+{amt} ML</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.motivationTxt, { color: '#3b82f6' }]}>
            {getWaterMotivation(waterProgress)}
          </Text>
        </View>
<TouchableOpacity 
  style={[styles.hospitalCard, { backgroundColor: theme.card, borderColor: theme.border }]}
  onPress={openNearbyHospitals}
  activeOpacity={0.7}
>
  <View style={styles.hospitalInfo}>
    <View style={{ backgroundColor: '#ef444415', padding: 10, borderRadius: 12 }}>
      <Ionicons name="medical" size={22} color="#ef4444" />
    </View>
    <View style={styles.hospitalTextContainer}>
      <Text style={[styles.hospitalTitle, { color: theme.text }]}>Emergency Care</Text>
      <Text style={[styles.hospitalSub, { color: theme.subText }]}>Find nearby hospitals & clinics</Text>
    </View>
  </View>
  
  <View style={styles.mapIconBg}>
    <Ionicons name="navigate-circle" size={24} color="#10b981" />
  </View>
</TouchableOpacity>
      </ScrollView>

      <Modal visible={showCustomModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
           <View style={[styles.modalContent, {backgroundColor: theme.card}]}>
              <Text style={[styles.modalTitle, {color: theme.text}]}>Custom Duration</Text>
              <TextInput 
                style={[styles.modalInput, {color: theme.text, borderColor: theme.border}]}
                placeholder="Minutes (e.g. 2)"
                placeholderTextColor={theme.subText}
                keyboardType="numeric"
                value={customInput}
                onChangeText={setCustomInput}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setShowCustomModal(false)} style={styles.modalBtn}>
                  <Text style={{color: theme.subText}}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => {
                    const mins = parseInt(customInput);
                    if (mins > 0) {
                      startBreathing(mins);
                      setShowCustomModal(false);
                      setCustomInput('');
                    }
                  }} 
                  style={[styles.modalBtn, {backgroundColor: theme.primary, borderRadius: 8}]}
                >
                  <Text style={{color: '#fff', fontWeight: 'bold'}}>Start</Text>
                </TouchableOpacity>
              </View>
           </View>
        </View>
      </Modal>
 












<TouchableOpacity style={styles.sosButton} onPress={handleSOS} activeOpacity={0.8}>
        <MaterialCommunityIcons name="phone-plus" size={28} color="#fff" />
        <Text style={styles.sosText}>SOS</Text>
      </TouchableOpacity>

      <BottomTabs />
      
            <Modal visible={showSettings} animationType="fade" transparent={true} onRequestClose={() => setShowSettings(false)}>
              <View style={styles.modalOverlay1}>
                <View style={[styles.modalContent1, { backgroundColor: theme.card }]}>
                  <View style={styles.modalHeader1}>
                    <Text style={[styles.modalTitle1, { color: theme.text }]}>Settings</Text>
                    <TouchableOpacity onPress={() => setShowSettings(false)}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
                  </View>
                  <View style={styles.menuList1}>
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
  hospitalCard: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hospitalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  hospitalTextContainer: {
    marginLeft: 12,
  },
  hospitalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  hospitalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  mapIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#10b98115',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: { flex: 1 },
  lottieOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  
  name: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  profileCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  
  tipCard: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  tipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tipTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipTitle: { fontSize: 16, fontWeight: '700' },
  tipContent: { fontSize: 14, lineHeight: 20, fontWeight: '500' },

  weatherCard: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 20,
  },
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  weatherGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', 
    marginBottom: 15,
  },
  weatherItem: {
    alignItems: 'center',
    flex: 1,
  },
  weatherVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  weatherLab: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  weatherVerticalDivider: {
    width: 1,
    height: 30,
    opacity: 0.2,
  },
  settingsBtn: { padding: 5 },
  modalOverlay1: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent1: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalHeader1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle1: { fontSize: 22, fontWeight: '800' },
  menuList1: { gap: 12 },
  menuBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 12 },
  menuIconContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuText: { fontSize: 16, fontWeight: '600' },
  weatherSuggestBox: {
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row', 
    alignItems: 'center', 
  },
  weatherSuggestTxt: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginLeft: 8, 
  },
  breathCard: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 20 },
  breathHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  breathTitle: { fontSize: 16, fontWeight: '700' },
  breathContainer: { height: 120, justifyContent: 'center', alignItems: 'center' },
  breathCircle: { width: 60, height: 60, borderRadius: 30, position: 'absolute' },
  breathStatus: { fontSize: 18, fontWeight: '800' },
  breathBtn: { height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  breathBtnText: { color: '#fff', fontWeight: 'bold' },
  breathOptionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 },
  timeOption: { width: 50, height: 40, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  timeOptionText: { fontWeight: '700' },
  breathSub: { textAlign: 'center', fontSize: 12, marginTop: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', padding: 25, borderRadius: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15 },
  modalInput: { borderWidth: 1, padding: 12, borderRadius: 10, marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15 },
  modalBtn: { padding: 10 },

  stepCard: { padding: 20, borderRadius: 28, borderWidth: 1.5, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  stepTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  stepIconBg: { width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  stepTitleContainer: { flex: 1, marginLeft: 15 },
  stepMainTitle: { fontSize: 18, fontWeight: '800' },
  goalBadge: { backgroundColor: '#10b98125', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  goalBadgeText: { color: '#059669', fontSize: 10, fontWeight: '800' },
  stepStatsContainer: { alignItems: 'flex-end' },
  stepBigNumber: { fontSize: 24, fontWeight: '900', letterSpacing: -1 },
  stepSubLabel: { fontSize: 10, fontWeight: '700', opacity: 0.6 },
  stepProgressContainer: { height: 12, borderRadius: 6, width: '100%', overflow: 'hidden', marginBottom: 15 },
  stepProgressFill: { height: '100%', borderRadius: 6 },
  stepFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#8882', paddingTop: 15 },
  footerItem: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  goalStatus: { fontSize: 12, fontWeight: '900' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 15 },
  statusScroll: { flexDirection: 'row', marginBottom: 20 },
  statusCard: { paddingHorizontal: 15, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, marginRight: 10, alignItems: 'center', flexDirection: 'row', gap: 8 },
  statusLabel: { fontSize: 14, fontWeight: '600' },
  adviceCard: { padding: 18, borderRadius: 20, borderWidth: 1, marginBottom: 25, borderStyle: 'dashed' },
  adviceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  adviceTitle: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase' },
  adviceText: { fontSize: 15, lineHeight: 22, fontWeight: '500', marginBottom: 12 },
  tipBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tipText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  waterCard: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 20 },
  waterHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconCircle: { width: 45, height: 45, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  waterAmountText: { fontSize: 20, fontWeight: '800' },
  progressBarBg: { height: 8, borderRadius: 4, width: '100%', marginBottom: 15, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  sosButton: { position: 'absolute', bottom: 85, right: 20, backgroundColor: '#ef4444', width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', elevation: 10, zIndex: 999, borderWidth: 3, borderColor: '#fff' },
  sosText: { color: '#fff', fontWeight: 'bold', marginTop: 4 },
  waterActions: { flexDirection: 'row', gap: 12 },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  streakTextContainer: {
    flex: 1,
  },
  streakNumber: {
    fontSize: 18,
    fontWeight: '800',
  },
  streakSubtext: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8,
  },
  waterBtn: { backgroundColor: '#3b82f6', height: 45, borderRadius: 14, flex: 1, alignItems: 'center', justifyContent: 'center' },
  waterBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  motivationTxt: { textAlign: 'center', fontSize: 12, fontWeight: '800', marginTop: 15, fontStyle: 'italic' },
});
export default Home;