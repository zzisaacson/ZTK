import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import ChordDetector from './src/components/ChordDetector';
import RhythmTest from './src/components/RhythmTest';
import GuitarTuner from './src/components/GuitarTuner';
import NoteByNote from './src/components/NoteByNote';

const TABS = [
  { key: 'learn',  label: 'Learn' },
  { key: 'tuner',  label: 'Tuner' },
  { key: 'chord',  label: 'Chords' },
  { key: 'rhythm', label: 'Rhythm' },
];

export default function App() {
  const [tab, setTab] = useState('chord');

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.content}>
        {tab === 'learn'  && <NoteByNote />}
        {tab === 'tuner'  && <GuitarTuner />}
        {tab === 'chord'  && <ChordDetector />}
        {tab === 'rhythm' && <RhythmTest />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },
  tabBar: { flexDirection: 'row', backgroundColor: '#16213e', paddingTop: 8 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#4CAF50' },
  tabText: { color: '#aaa', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#4CAF50' },
  content: { flex: 1 },
});
