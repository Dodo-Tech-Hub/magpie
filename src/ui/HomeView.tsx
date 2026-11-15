import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, PixelRatio, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { PLATFORMS, readyBySection, type Platform } from '@/platforms/platforms';
import { useApp } from '@/state/AppState';
import { openProgress } from '@/state/flows';
import { strings } from '@/strings';
import { useTheme, type Colors } from '@/theme/theme';
import { columnsFor } from '@/ui/gridColumns';
import { PlatformCard } from '@/ui/PlatformCard';

type Unfinished = { left: number; ids: string[] };

// The platform picker: ready platforms in an Automatic and a Guided section.
export function HomeView({ platforms = PLATFORMS }: { platforms?: Platform[] }) {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const columns = columnsFor(useWindowDimensions().width, PixelRatio.getFontScale());
  const [unfinished, setUnfinished] = useState<Record<string, Unfinished>>({});

  // Read what is left after the card shows. No loading indicator (FR-019).
  useEffect(() => {
    let live = true;
    void Promise.all(platforms.map(async (p) => [p.id, await p.unfinished()] as const)).then(
      (all) => live && setUnfinished(Object.fromEntries(all)),
    );
    return () => {
      live = false;
    };
  }, [platforms, state.platform, state.moveState, state.progressId, state.items]);

  const onContinue = (p: Platform) => {
    const { ids = [] } = unfinished[p.id] ?? {};
    if (ids.length === 1) {
      void openProgress(dispatch, ids[0]);
    } else {
      p.open(dispatch);
      dispatch({ type: 'setStep', step: 'from' });
    }
  };

  const labels = { automatic: strings.sectionAutomatic, guided: strings.sectionGuided };
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {readyBySection(platforms).map(({ section, platforms: list }) => (
        <View key={section}>
          <Text style={styles.header} accessibilityRole="header">
            {labels[section]}
          </Text>
          <FlatList
            key={columns}
            data={list}
            numColumns={columns}
            scrollEnabled={false}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <View testID={`cell-${item.id}`} style={{ width: `${100 / columns}%`, padding: 6 }}>
                <PlatformCard
                  platform={item}
                  left={unfinished[item.id]?.left}
                  onOpen={() => item.open(dispatch)}
                  onContinue={() => onContinue(item)}
                />
              </View>
            )}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    content: { padding: 10 },
    header: { color: c.text, fontSize: 18, fontWeight: '600', paddingHorizontal: 6, paddingVertical: 8 },
  });
