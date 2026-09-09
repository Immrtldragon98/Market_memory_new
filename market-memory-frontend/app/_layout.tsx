import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MarketSamplingProvider } from '../src/core/lifecycle/MarketSamplingProvider';

export default function RootLayout() {
  return (
    <MarketSamplingProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </MarketSamplingProvider>
  );
}
