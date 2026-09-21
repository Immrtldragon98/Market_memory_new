import type { TextStyle, ViewStyle } from 'react-native';

export const theme = {
  colors: {
    bg: '#080D18', surface: '#101827', panel: '#101827', elevated: '#151F31', panelElevated: '#151F31',
    border: '#243044', borderSubtle: '#182337', text: '#F3F6FA', textSecondary: '#AAB4C3',
    textMuted: '#8F9CAF', textDim: '#657287', accent: '#69A7FF', primary: '#69A7FF', accentSoft: '#142A47',
    primaryStrong: '#397FD7', positive: '#65C59A', success: '#65C59A', negative: '#E98282', danger: '#E98282',
    review: '#D6AD65', warning: '#D6AD65',
  },
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  space: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, hero: 64 },
  type: {
    pageTitle: { fontSize: 30, lineHeight: 38, fontWeight: '600' } as TextStyle,
    sectionTitle: { fontSize: 17, lineHeight: 24, fontWeight: '600' } as TextStyle,
    asset: { fontSize: 17, lineHeight: 22, fontWeight: '600' } as TextStyle,
    marketValue: { fontSize: 22, lineHeight: 28, fontWeight: '500' } as TextStyle,
    body: { fontSize: 15, lineHeight: 23, fontWeight: '400' } as TextStyle,
    caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' } as TextStyle,
    metadata: { fontSize: 11, lineHeight: 16, fontWeight: '500', letterSpacing: .35 } as TextStyle,
  },
};

export const layout = {
  readable: { width: '100%', maxWidth: 880, alignSelf: 'center' } as ViewStyle,
  wide: { width: '100%', maxWidth: 1120, alignSelf: 'center' } as ViewStyle,
};
