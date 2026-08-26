export type AssetType = 'stock' | 'crypto';

export interface MarketObservation {
  id: number;
  symbol: string;
  observation: string;
  price: number | null;
  created_at: string;
}

export interface MarketSnapshot {
  id: number;
  symbol: string;
  note: string | null;
  price: number | null;
  created_at: string;
}
