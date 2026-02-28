import { useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Platform,
  Image,
  useColorScheme,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { themes } from "../constants/themes";
import { SafeAreaView } from "react-native-safe-area-context";
import Head from "expo-router/head";
const isWeb = Platform.OS === "web";

const Splash = () => {
  const colourscheme = useColorScheme();
  const theme = themes[colourscheme] ?? themes.light;
  const router = useRouter();
  const Container = isWeb ? View : SafeAreaView;

  useEffect(() => {
    const prepareNavigation = async () => {
      try {
        const timer = new Promise((resolve) => setTimeout(resolve, 2000));

        const sessionCheck = AsyncStorage.getItem("patientSession");

        const [_, storedUser] = await Promise.all([timer, sessionCheck]);

        if (storedUser) {
          router.replace("/home");
        } else {
          router.replace("/login");
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        router.replace("/login");
      }
    };

    prepareNavigation();
  }, [router]);

  return (
    <>
      <Head>
        <title>Patient Portal</title>
        <meta name="description" content="Patient Access Portal" />
      </Head>
      <Container
        style={[
          isWeb ? styles.web.container : styles.mobile.container,
          { backgroundColor: theme.background },
        ]}
      >
        <StatusBar style={colourscheme === "dark" ? "light" : "dark"} />

        <Image
          source={
            colourscheme === "dark"
              ? require("../assets/splashdark.png")
              : require("../assets/splashlight.png")
          }
          style={isWeb ? styles.web.logo : styles.mobile.logo}
        />

        <View style={isWeb ? styles.web.spacer : styles.mobile.spacer} />

        <Text
          style={[
            isWeb ? styles.web.title : styles.mobile.title,
            { color: theme.text },
          ]}
        >
          Patient Portal
        </Text>

        <Text
          style={[
            isWeb ? styles.web.subText : styles.mobile.subText,
            { color: theme.subText },
          ]}
        >
         Your Health, Managed Simply
        </Text>

        <View
          style={[
            styles.divider,
            { backgroundColor: theme.subText },
            isWeb && { width: 200 },
          ]}
        />
      </Container>
    </>
  );
};

const styles = StyleSheet.create({
  divider: {
    width: "60%",
    height: 1,
    opacity: 0.2,
    marginVertical: 15,
  },
  mobile: {
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    logo: { width: 180, height: 180, resizeMode: "contain" },
    spacer: { height: 20 },
    title: {
      fontSize: 26,
      fontWeight: "800",
      textAlign: "center",
      marginBottom: 8,
    },
    subText: { fontSize: 14, textAlign: "center", opacity: 0.7 },
  },
  web: {
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
    },
    logo: { width: 220, height: 220, resizeMode: "contain" },
    spacer: { height: 30 },
    title: {
      fontSize: 36,
      fontWeight: "800",
      textAlign: "center",
      marginBottom: 12,
    },
    subText: { fontSize: 18, textAlign: "center", opacity: 0.8 },
  },
});

export default Splash;

















