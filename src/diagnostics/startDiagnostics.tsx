/* eslint-disable @typescript-eslint/no-require-imports -- each library must load only when its line is tapped */
// Start-up check for a release APK that closes right away, with no computer or logcat needed. It is only bundled
// into the entry when a diagnose-modules build sets EXPO_PUBLIC_YUME_DIAG=modules. It uses react-native alone,
// shows this screen, and loads one native-backed library per tap, so the last line on screen (or the button that
// closes the app) names the library that breaks.
import { useState } from 'react';
import { AppRegistry, Pressable, ScrollView, Text, View } from 'react-native';

type Check = { name: string; run: () => string | void };

const checks: Check[] = [
  { name: 'react-native-worklets', run: () => void require('react-native-worklets') },
  { name: 'react-native-reanimated', run: () => void require('react-native-reanimated') },
  { name: 'react-native-gesture-handler', run: () => void require('react-native-gesture-handler') },
  { name: 'react-native-screens', run: () => void require('react-native-screens') },
  { name: 'react-native-safe-area-context', run: () => void require('react-native-safe-area-context') },
  { name: 'expo-font', run: () => void require('expo-font') },
  { name: 'expo-file-system', run: () => void require('expo-file-system') },
  { name: 'expo-sharing', run: () => void require('expo-sharing') },
  { name: 'expo-status-bar', run: () => void require('expo-status-bar') },
  { name: 'expo-navigation-bar', run: () => void require('expo-navigation-bar') },
  { name: 'expo-local-authentication', run: () => void require('expo-local-authentication') },
  { name: 'expo-notifications', run: () => void require('expo-notifications') },
  { name: 'react-native-android-widget', run: () => void require('react-native-android-widget') },
  {
    name: 'expo-sqlite (open an in-memory database)',
    run: () => {
      const SQLite = require('expo-sqlite');
      const db = SQLite.openDatabaseSync(':memory:');
      return String(db.getFirstSync('select sqlite_version() as v').v);
    },
  },
  { name: 'expo-router', run: () => void require('expo-router') },
  { name: 'widget task handler', run: () => void require('../widgets/widgetTaskHandler') },
  { name: 'app root layout (loads the app screens)', run: () => void require('../../app/_layout') },
];

function Diagnostics() {
  const [results, setResults] = useState<Record<string, string>>({});
  const runOne = (check: Check) => {
    setResults((r) => ({ ...r, [check.name]: 'running...' }));
    let line: string;
    try {
      const extra = check.run();
      line = extra ? `OK (${extra})` : 'OK';
    } catch (e) {
      line = `FAILED: ${e instanceof Error ? e.message : String(e)}`;
    }
    setResults((r) => ({ ...r, [check.name]: line }));
  };
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={{ padding: 20, paddingTop: 56 }}
    >
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Yume start-up check</Text>
      <Text style={{ marginVertical: 8 }}>
        If you can read this, the app starts and JavaScript runs. Tap each line. If the app closes on a tap,
        that library is the one that breaks.
      </Text>
      <Pressable
        onPress={() => checks.forEach(runOne)}
        style={{ backgroundColor: '#222', padding: 12, borderRadius: 8, marginBottom: 12 }}
      >
        <Text style={{ color: '#fff', textAlign: 'center' }}>Run all (top to bottom)</Text>
      </Pressable>
      {checks.map((c) => (
        <Pressable key={c.name} onPress={() => runOne(c)} style={{ paddingVertical: 10 }}>
          <Text style={{ fontWeight: '600' }}>{c.name}</Text>
          <Text>{results[c.name] ?? 'tap to load'}</Text>
        </Pressable>
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

AppRegistry.registerComponent('main', () => Diagnostics);
