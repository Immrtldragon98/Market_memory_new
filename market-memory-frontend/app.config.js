const baseConfig = require('./app.json');

module.exports = () => ({
  ...baseConfig.expo,
  extra: {
    ...baseConfig.expo.extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL || baseConfig.expo.extra.apiUrl,
    supabaseUrl:
      process.env.EXPO_PUBLIC_SUPABASE_URL || baseConfig.expo.extra.supabaseUrl,
    supabaseAnonKey:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
      baseConfig.expo.extra.supabaseAnonKey,
  },
});
