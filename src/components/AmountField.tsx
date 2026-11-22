import {
  createContext,
  useCallback,
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
  type TextInputInstance,
  ViewInstance,
} from 'react-native';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormInput } from '@/components/FormInput';
import { TextInput } from '@/components/Text';
import { PrimaryButton } from '@/components/PrimaryButton';
import { theme } from '@/constants/theme';
import { PadButton } from '@/components/AmountPad';
import { applyPadKey, type PadKey } from '@/lib/padMath';
import { themedStyles } from '@/theme/themedStyles';

/** What the docked pad edits: the focused field's current text and how to change it. */
interface AmountSlot {
  value: string;
  onChangeText: (value: string) => void;
  decimal: boolean;
  maxLength?: number;
}

interface PadHost {
  open: (id: string, slot: MutableRefObject<AmountSlot>, node: RefObject<ViewInstance | null>) => void;
  close: (id: string) => void;
  /** Lists a field so the pad's Next key can reach it; returns the undo. */
  register: (id: string, node: RefObject<ViewInstance | null>, focus: () => void) => () => void;
}

interface PadField {
  node: RefObject<ViewInstance | null>;
  focus: () => void;
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
  // Every amount field on this page, in the order they mounted (the fallback order for Next).
  const fields = useRef(new Map<string, PadField>());
  const [fieldCount, setFieldCount] = useState(0);
  const scrollOffset = useRef(0);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    },
    []
  );

  // A field of this kind never raises the phone keyboard, so one rising means a text field took focus: the pad must
  // not stay under it (both at once squeezed the sheet to a sliver).
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => setActive(null));
    return () => sub.remove();
  }, []);

  const host = useMemo<PadHost>(() => {
    const scrollIntoView = (node: ViewInstance) => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      // Wait a beat so the scroll view has resized for the pad before measuring.
      scrollTimer.current = setTimeout(() => {
        const scroll = scrollRef.current;
        if (!scroll) return;
        (scroll as unknown as ViewInstance).measureInWindow((_sx, sy, _sw, sh) => {
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
      register: (id, node, focus) => {
        fields.current.set(id, { node, focus });
        setFieldCount(fields.current.size);
        return () => {
          fields.current.delete(id);
          setFieldCount(fields.current.size);
        };
      },
    };
  }, []);

  /**
   * Moves to the amount field after `id` (by where they sit on screen, top to bottom, left to right), or closes the
   * pad from the last one. Fields that cannot be measured keep the order they mounted in.
   */
  const goNext = useCallback(async (id: string) => {
    const entries = [...fields.current.entries()];
    const placed = await Promise.all(
      entries.map(
        ([key, field]) =>
          new Promise<{ key: string; field: PadField; x: number; y: number } | null>((resolve) => {
            const node = field.node.current;
            if (!node || typeof node.measureInWindow !== 'function') return resolve(null);
            node.measureInWindow((x, y) => resolve({ key, field, x, y }));
          })
      )
    );
    const ordered = placed.every((item) => item !== null)
      ? (placed as { key: string; field: PadField; x: number; y: number }[])
          // Fields within a few points of the same height are one row: left to right.
          .sort((a, b) => (Math.abs(a.y - b.y) < 8 ? a.x - b.x : a.y - b.y))
          .map(({ key, field }) => ({ key, field }))
      : entries.map(([key, field]) => ({ key, field }));
    const next = ordered[ordered.findIndex((item) => item.key === id) + 1];
    if (next) next.field.focus();
    else Keyboard.dismiss();
  }, []);

  const scrollProps = {
    ref: scrollRef,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.current = e.nativeEvent.contentOffset.y;
    },
    scrollEventThrottle: 16,
  };
  const pad = active ? (
    <NumberPad slot={active.slot} onNext={fieldCount > 1 ? () => void goNext(active.id) : undefined} />
  ) : null;
  return { host, pad, scrollProps };
}

type ScrollProps = ReturnType<typeof useAmountPadHost>['scrollProps'];

/** A whole screen's host: the content above, the pad docked under it while an amount field has focus. */
export function AmountPadDock({
  children,
}: {
  children: (scrollProps: ScrollProps, padVisible: boolean) => ReactNode;
}) {
  const { host, pad, scrollProps } = useAmountPadHost();
  const insets = useSafeAreaInsets();
  return (
    <AmountPadHostProvider value={host}>
      <View style={styles.dockContent}>{children(scrollProps, pad !== null)}</View>
      {pad && <View style={[styles.screenDock, { paddingBottom: 12 + insets.bottom }]}>{pad}</View>}
    </AmountPadHostProvider>
  );
}

function NumberPad({ slot, onNext }: { slot: MutableRefObject<AmountSlot>; onNext?: () => void }) {
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
      {/* Next only when the page has more than one amount field: it walks down them, so a form of three amounts
          is filled without reaching up to tap each. */}
      <View style={styles.row}>
        <PrimaryButton
          title="Done"
          variant={onNext ? 'secondary' : 'primary'}
          style={[styles.done, styles.doneBtn]}
          onPress={() => Keyboard.dismiss()}
        />
        {onNext && <PrimaryButton title="Next" style={[styles.done, styles.doneBtn]} onPress={onNext} />}
      </View>
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
export const AmountField = forwardRef<TextInputInstance, Props>(function AmountField(
  { label, decimal = true, value, onChangeText, onFocus, onBlur, style, ...rest },
  ref
) {
  const host = useContext(PadHostContext);
  const id = useId();
  const wrapRef = useRef<ViewInstance>(null);
  const inputRef = useRef<TextInputInstance | null>(null);
  const setInput = (node: TextInputInstance | null) => {
    inputRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };
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
  useEffect(() => host?.register(id, wrapRef, () => inputRef.current?.focus()), [host, id]);

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
          ref={setInput}
          value={value}
          onChangeText={onChangeText}
          style={style}
          {...hostProps}
          {...rest}
        />
      ) : (
        <FormInput
          ref={setInput}
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

const styles = themedStyles(() =>
  StyleSheet.create({
    dockContent: { flex: 1 },
    screenDock: {
      paddingHorizontal: 16,
      paddingTop: 10,
      backgroundColor: theme.colors.surfaceAlt,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.borderSoft,
    },
    pad: { gap: 8 },
    row: { flexDirection: 'row', gap: 8 },
    gap: { flex: 1 },
    done: { paddingVertical: 12 },
    doneBtn: { flex: 1 },
    figure: { fontFamily: theme.font.bodyBold, fontVariant: ['tabular-nums'], fontSize: 15 },
  })
);
