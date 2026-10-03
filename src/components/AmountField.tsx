import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Keyboard,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInputProps,
  type TextInput as RNTextInput,
} from 'react-native';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormInput } from '@/components/FormInput';
import { TextInput } from '@/components/Text';
import { PrimaryButton } from '@/components/PrimaryButton';
import { theme } from '@/constants/theme';
import { PadButton } from '@/components/AmountPad';
import { applyPadKey, type PadKey } from '@/lib/padMath';

/** What the docked pad edits: the focused field's current text and how to change it. */
interface AmountSlot {
  value: string;
  onChangeText: (value: string) => void;
  decimal: boolean;
  maxLength?: number;
}

interface PadHost {
  open: (id: string, slot: MutableRefObject<AmountSlot>, node: RefObject<View | null>) => void;
  close: (id: string) => void;
}

const PadHostContext = createContext<PadHost | null>(null);
export const AmountPadHostProvider = PadHostContext.Provider;

const ROWS: PadKey[][] = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['.', '0', 'back'],
];

/**
 * State behind a docked number pad: wrap the tree in `AmountPadHostProvider value={host}`, render `pad`
 * where the keyboard would be, spread `scrollProps` on the scroll view (it scrolls the field clear).
 */
export function useAmountPadHost() {
  const [active, setActive] = useState<{ id: string; slot: MutableRefObject<AmountSlot> } | null>(null);
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const scrollOffset = useRef(0);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    },
    []
  );

  const host = useMemo<PadHost>(() => {
    const scrollIntoView = (node: View) => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      // Wait a beat so the scroll view has resized for the pad before measuring.
      scrollTimer.current = setTimeout(() => {
        const scroll = scrollRef.current;
        if (!scroll) return;
        (scroll as unknown as View).measureInWindow((_sx, sy, _sw, sh) => {
          node.measureInWindow((_fx, fy, _fw, fh) => {
            const margin = 16;
            if (fy < sy + margin) {
              scroll.scrollTo({ y: Math.max(0, scrollOffset.current - (sy + margin - fy)), animated: true });
            } else if (fy + fh > sy + sh - margin) {
              scroll.scrollTo({ y: scrollOffset.current + (fy + fh - (sy + sh) + margin), animated: true });
            }
          });
        });
      }, 120);
    };
    return {
      open: (id, slot, node) => {
        setActive({ id, slot });
        if (node.current) scrollIntoView(node.current);
      },
      close: (id) => setActive((cur) => (cur?.id === id ? null : cur)),
    };
  }, []);

  const scrollProps = {
    ref: scrollRef,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.current = e.nativeEvent.contentOffset.y;
    },
    scrollEventThrottle: 16,
  };
  const pad = active ? <NumberPad slot={active.slot} /> : null;
  return { host, pad, scrollProps };
}

type ScrollProps = ReturnType<typeof useAmountPadHost>['scrollProps'];

/** A whole screen's host: the content above, the pad docked under it while an amount field has focus. */
export function AmountPadDock({ children }: { children: (scrollProps: ScrollProps) => ReactNode }) {
  const { host, pad, scrollProps } = useAmountPadHost();
  const insets = useSafeAreaInsets();
  return (
    <AmountPadHostProvider value={host}>
      <View style={styles.dockContent}>{children(scrollProps)}</View>
      {pad && <View style={[styles.screenDock, { paddingBottom: 12 + insets.bottom }]}>{pad}</View>}
    </AmountPadHostProvider>
  );
}

function NumberPad({ slot }: { slot: MutableRefObject<AmountSlot> }) {
  const press = (key: PadKey) => {
    const { value, onChangeText, decimal, maxLength } = slot.current;
    if (key === '.' && !decimal) return;
    const next = applyPadKey(value, key);
    if (key !== 'back' && maxLength != null && next.length > maxLength) return;
    if (next !== value) onChangeText(next);
  };
  return (
    <View style={styles.pad}>
      {ROWS.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((key) =>
            key === '.' && !slot.current.decimal ? (
              <View key={key} style={styles.gap} />
            ) : (
              <PadButton
                key={key}
                padKey={key}
                compact
                onPress={() => press(key)}
                onLongPress={key === 'back' ? () => slot.current.onChangeText('') : undefined}
              />
            )
          )}
        </View>
      ))}
      <PrimaryButton title="Done" style={styles.done} onPress={() => Keyboard.dismiss()} />
    </View>
  );
}

interface Props extends Omit<TextInputProps, 'keyboardType' | 'inputMode' | 'showSoftInputOnFocus'> {
  /** Omit for a bare input that brings its own styling and label. */
  label?: string;
  /** False for whole numbers only — months, days, counts. */
  decimal?: boolean;
}

/**
 * A number field (money, rates, months, days) that never opens the phone keyboard: focus docks Yume's pad
 * (see `useAmountPadHost`) so Save stays in view. Outside a host it falls back to a plain numeric input.
 */
export const AmountField = forwardRef<RNTextInput, Props>(function AmountField(
  { label, decimal = true, value, onChangeText, onFocus, onBlur, style, ...rest },
  ref
) {
  const host = useContext(PadHostContext);
  const id = useId();
  const wrapRef = useRef<View>(null);
  const slot = useRef<AmountSlot>({ value: '', onChangeText: () => {}, decimal, maxLength: rest.maxLength });
  useEffect(() => {
    slot.current = {
      value: value ?? '',
      onChangeText: onChangeText ?? (() => {}),
      decimal,
      maxLength: rest.maxLength,
    };
  });

  useEffect(() => () => host?.close(id), [host, id]);

  const hostProps = host
    ? {
        showSoftInputOnFocus: false,
        onFocus: (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
          host.open(id, slot, wrapRef);
          onFocus?.(e);
        },
        onBlur: (e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
          host.close(id);
          onBlur?.(e);
        },
      }
    : { keyboardType: decimal ? ('decimal-pad' as const) : ('number-pad' as const), onFocus, onBlur };

  return (
    <View ref={wrapRef} collapsable={false}>
      {label === undefined ? (
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          style={style}
          {...hostProps}
          {...rest}
        />
      ) : (
        <FormInput
          ref={ref}
          label={label}
          value={value}
          onChangeText={onChangeText}
          style={[styles.figure, style]}
          {...hostProps}
          {...rest}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  dockContent: { flex: 1 },
  screenDock: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: theme.colors.surfaceAlt,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  pad: { gap: 7 },
  row: { flexDirection: 'row', gap: 7 },
  gap: { flex: 1 },
  done: { paddingVertical: 11 },
  figure: { fontFamily: theme.font.monoBold, fontSize: 16 },
});
