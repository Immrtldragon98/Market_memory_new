import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Market Memory',
  slug: 'market-memory',
  scheme: 'marketmemory',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  plugins: ['expo-router'],
  experiments: { typedRoutes: true },
  extra: {
    ...config.extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  },
});
