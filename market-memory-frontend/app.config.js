const baseConfig = require('./app.json');
const productionApiUrl = 'https://market-memory-api-s4sj.onrender.com';

module.exports = () => ({
  ...baseConfig.expo,
  extra: {
    ...baseConfig.expo.extra,
    apiUrl:
      process.env.EXPO_PUBLIC_API_URL ||
      (process.env.NODE_ENV === 'production'
        ? productionApiUrl
        : baseConfig.expo.extra.apiUrl),
    supabaseUrl:
      process.env.EXPO_PUBLIC_SUPABASE_URL || baseConfig.expo.extra.supabaseUrl,
    supabaseAnonKey:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
      baseConfig.expo.extra.supabaseAnonKey,
  },
});
