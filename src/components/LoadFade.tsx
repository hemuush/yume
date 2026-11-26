import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SolidFade } from './SolidFade';

/**
 * The content of a screen that starts on placeholders: while it loads the placeholders show as they are, and when
 * the data arrives the real content is a new view that fades in once (the same short plain fade as a Plan or
 * Reports tab swap), instead of cutting from grey bars to cards. The header and the wallpaper stay solid; only
 * what was loading changes. Off with the phone's reduce-motion setting (`CONTENT_ENTER` carries it).
 */
export function LoadFade({
  loaded,
  children,
  style,
}: {
  /** False while the placeholders show. */
  loaded: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SolidFade key={loaded ? 'loaded' : 'loading'} play={loaded} rise={loaded ? 10 : 0} style={style}>
      {children}
    </SolidFade>
  );
}
