import Svg, { Circle, Ellipse, Rect, Mask, Defs, G } from 'react-native-svg';
import { theme } from '@/constants/theme';
import type { GrowthStage } from '@/lib/gardenGrowth';

const STEM_HEIGHT: Record<GrowthStage, number> = { seed: 0, sprout: 16, sapling: 21, bloom: 25 };
const LEAF_SCALE: Record<GrowthStage, number> = { seed: 0, sprout: 0.55, sapling: 0.8, bloom: 1 };

/**
 * One pot's plant, drawn at a fixed 44x56 viewBox and scaled by `size` —
 * the same crescent-and-two-leaf-sprout language as the app icon
 * (`logo-mark.svg`), just redrawn small and stage-by-stage rather than
 * reusing that asset directly (it has no in-between growth states). `seed`
 * is deliberately almost nothing to look at — the point is watching it
 * become something, not a placeholder icon.
 */
export function GardenPlant({ stage, size = 44 }: { stage: GrowthStage; size?: number }) {
  const stemH = STEM_HEIGHT[stage];
  const leafScale = LEAF_SCALE[stage];
  const baseY = 56;
  const stemTopY = baseY - stemH;

  return (
    <Svg width={size} height={(size * 56) / 44} viewBox="0 0 44 56">
      {stage === 'bloom' && (
        <Defs>
          <Mask id="crescent" maskUnits="userSpaceOnUse" x="0" y="0" width="44" height="56">
            <Rect x="0" y="0" width="44" height="56" fill="white" />
            <Circle cx={31} cy={13} r={15} fill="black" />
          </Mask>
        </Defs>
      )}
      {stage === 'seed' ? (
        <Circle cx={22} cy={baseY - 3} r={2.6} fill={theme.colors.ink} opacity={0.45} />
      ) : (
        <G>
          {stage === 'bloom' && (
            <Circle cx={22} cy={13} r={15} fill={theme.colors.ink} mask="url(#crescent)" />
          )}
          <Rect x={21} y={stemTopY} width={2} height={stemH} fill={theme.colors.ink} />
          <Ellipse
            cx={22 - 8 * leafScale}
            cy={stemTopY + stemH * 0.42}
            rx={7 * leafScale}
            ry={11 * leafScale}
            fill={theme.colors.flatLime}
            transform={`rotate(-32 ${22 - 8 * leafScale} ${stemTopY + stemH * 0.42})`}
          />
          <Ellipse
            cx={22 + 8 * leafScale}
            cy={stemTopY + stemH * 0.42}
            rx={7 * leafScale}
            ry={11 * leafScale}
            fill={theme.colors.secondary}
            transform={`rotate(32 ${22 + 8 * leafScale} ${stemTopY + stemH * 0.42})`}
          />
        </G>
      )}
    </Svg>
  );
}
