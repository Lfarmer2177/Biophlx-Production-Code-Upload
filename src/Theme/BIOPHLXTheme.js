import { useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { palettes, resolveColor } from './BIOPHLXTokens';

export function useBIOPHLXTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return useMemo(() => {
    const colors = palettes[scheme];
    const style = (input, role = '') => {
      const flat = StyleSheet.flatten(input);
      if (!flat) return flat;
      return Object.fromEntries(Object.entries({ ...(flat.borderWidth ? { borderColor: colors.border } : {}), ...flat }).map(([key,value]) => [key,
        /color$/i.test(key) ? resolveColor(value,key,colors,role) : value]));
    };
    return { colors, dark: scheme === 'dark', style,
      color: value => resolveColor(value,'color',colors),
      styles: source => Object.fromEntries(Object.entries(source).map(([key,value])=>[key,style(value,key)])),
    };
  }, [scheme]);
}
