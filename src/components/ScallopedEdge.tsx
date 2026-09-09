import Svg, { Path } from 'react-native-svg';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Flynse's one recurring shape motif: a scalloped (wave) edge, used
 * wherever a solid-color section hands off to the cream body — instead of
 * every screen defaulting to a flat rule or a rounded-rectangle card
 * floating on the background, which is what nearly every other app does.
 */
export function ScallopedEdge({
  color,
  width = SCREEN_WIDTH,
  height = 28,
}: {
  color: string;
  width?: number;
  height?: number;
}) {
  const bumps = 8;
  const bumpWidth = width / bumps;
  // Each bump dips from the flat top edge (y=0) down to `height` and back to
  // 0 — closing straight back along y=0 turns that into a hanging scallop
  // shape rather than a solid band with notches cut into it.
  let path = `M0 0 `;
  for (let i = 0; i < bumps; i++) {
    const x = i * bumpWidth;
    path += `Q ${x + bumpWidth / 2} ${height} ${x + bumpWidth} 0 `;
  }
  path += `Z`;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ marginTop: -1 }}>
      <Path d={path} fill={color} />
    </Svg>
  );
}
