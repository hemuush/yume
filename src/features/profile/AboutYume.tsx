import { memo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Application from 'expo-application';
import ReanimatedAnimated from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { YumeLogo } from '@/components/YumeLogo';
import { cardSurface } from '@/components/CardSurface';
import type { McIconName } from '@/components/iconName';
import { screenStyles as h } from '@/components/screenStyles';
import { theme } from '@/constants/theme';
import { PANEL_ENTER, ROW_EXIT } from '@/lib/animation';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { styles } from './profile.styles';

function AboutFact({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.aboutFactRow}>
      <MaterialCommunityIcons name={icon as McIconName} size={15} color={theme.colors.textSecondary} />
      <Text style={styles.aboutFactText}>{text}</Text>
    </View>
  );
}

/**
 * The foot of Settings: the app's name and version, and an About panel that opens in place. Whether it is open is this
 * part's own state, so opening it draws these few lines, not the whole Settings page above.
 */
export const AboutYume = memo(function AboutYume() {
  const { accent } = useAccent();
  const [aboutOpen, setAboutOpen] = useState(false);
  return (
    <>
      <View style={styles.footer}>
        <YumeLogo size={30} />
        <Text style={styles.footerName}>Yume · v{Application.nativeApplicationVersion ?? '1.0.0'}</Text>
        <Text style={styles.footerSub}>Works fully offline.</Text>
        <Pressable
          onPress={() => setAboutOpen((v) => !v)}
          hitSlop={8}
          style={withPressedTint(accent, styles.footerLink)}
          accessibilityRole="button"
          accessibilityState={{ expanded: aboutOpen }}
          accessibilityLabel="About Yume"
        >
          <Text style={styles.footerLinkText}>{aboutOpen ? 'Hide' : 'About Yume'}</Text>
          <Feather
            name={aboutOpen ? 'chevron-up' : 'chevron-right'}
            size={14}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      </View>
      {aboutOpen && (
        <ReanimatedAnimated.View entering={PANEL_ENTER} exiting={ROW_EXIT}>
          <View style={[h.card, cardSurface.neutral, styles.aboutCard]}>
            <Text style={styles.aboutTagline}>Track every rupee, on your terms.</Text>
            <View style={styles.aboutFacts}>
              <AboutFact icon="wifi-off" text="Works fully offline — no account, no server, no signup." />
              <AboutFact
                icon="lock-outline"
                text="Your data never leaves this device unless you back it up."
              />
              <AboutFact
                icon="file-document-outline"
                text="Backups are plain JSON you can open and read yourself."
              />
            </View>
          </View>
        </ReanimatedAnimated.View>
      )}
    </>
  );
});
