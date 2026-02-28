import React from "react";
import { View, Text, ActivityIndicator, StyleSheet, useColorScheme } from "react-native";
import { themes } from '../../constants/themes'; 

const Loading = () => {
  const colorScheme = useColorScheme();
  const theme = themes[colorScheme] ?? themes.light;

  return (
    <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.primary} />
      
      <Text style={[styles.loadingText, { color: theme.subText }]}>
          Loading...
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});

export default Loading;