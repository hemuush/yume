import { ScrollView, View } from 'react-native';
import { Text } from '@/components/Text';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SkyHeader } from '@/features/home/SkyHeader';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { useAccent } from '@/theme/AccentContext';
import { theme } from '@/constants/theme';

/** Initial fetch failure: show an honest, recoverable state instead of invented empty data. */
export function ScreenLoadError({
  title,
  message,
  onRetry,
  embedded = false,
}: {
  title: string;
  message: string;
  onRetry: () => void;
  embedded?: boolean;
}) {
  const { accent, secondary } = useAccent();
  const content = (
    <View style={{ padding: 20, gap: 12 }}>
      <Text style={{ fontFamily: theme.font.bodyBold, fontSize: 16 }}>Couldn't load your data</Text>
      <Text style={{ fontFamily: theme.font.body, color: theme.colors.textSecondary, fontSize: 13 }}>
        {message}
      </Text>
      <PrimaryButton title="Retry" variant="secondary" onPress={onRetry} />
    </View>
  );
  if (embedded) return content;
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <HomeWallpaper accent={accent} secondary={secondary} />
      <SkyHeader title={title} showBack hideUser wallpaper />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>{content}</ScrollView>
    </View>
  );
}
