"use client";

import { create } from 'zustand';
import type { AirportSelection, Cabin } from '@/lib/types';
import { toYmd } from '@/lib/utils';

export const SEARCH_STATE_KEY = 'apg_search_page_state';

export const DEFAULT_FROM_SEL: AirportSelection = { code: 'HAN', label: 'Hà Nội (HAN) - Nội Bài' };
export const DEFAULT_TO_SEL: AirportSelection = { code: 'SGN', label: 'TP.HCM (SGN) - Tân Sơn Nhất' };

export type RoundtripViewMode = 'pair' | 'legs';
export type FlightSortMode = 'price' | 'time';
export type TripType = 'oneway' | 'roundtrip';

type HomeSearchStore = {
  adults: number;
  cabin: Cabin;
  children: number;
  date: string;
  fromSel: AirportSelection | null;
  hydrated: boolean;
  infants: number;
  pairSourceFilter: string;
  returnDate: string;
  roundtripViewMode: RoundtripViewMode;
  sortDepart: FlightSortMode;
  sortOneway: FlightSortMode;
  sortReturn: FlightSortMode;
  toSel: AirportSelection | null;
  tripType: TripType;
  setCabin: (value: Cabin) => void;
  setDate: (value: string) => void;
  setFromSel: (value: AirportSelection | null) => void;
  setHydrated: (value: boolean) => void;
  setPairSourceFilter: (value: string) => void;
  setPassengerCounts: (value: { adults: number; children: number; infants: number }) => void;
  setReturnDate: (value: string) => void;
  setRoundtripViewMode: (value: RoundtripViewMode) => void;
  setSortDepart: (value: FlightSortMode) => void;
  setSortOneway: (value: FlightSortMode) => void;
  setSortReturn: (value: FlightSortMode) => void;
  setToSel: (value: AirportSelection | null) => void;
  setTripType: (value: TripType) => void;
};

export const useHomeSearchStore = create<HomeSearchStore>((set) => ({
  adults: 1,
  cabin: 'economy',
  children: 0,
  date: toYmd(7),
  fromSel: DEFAULT_FROM_SEL,
  hydrated: false,
  infants: 0,
  pairSourceFilter: 'all',
  returnDate: '',
  roundtripViewMode: 'legs',
  sortDepart: 'price',
  sortOneway: 'price',
  sortReturn: 'price',
  toSel: DEFAULT_TO_SEL,
  tripType: 'oneway',
  setCabin: (value) => set({ cabin: value }),
  setDate: (value) => set({ date: value }),
  setFromSel: (value) => set({ fromSel: value }),
  setHydrated: (value) => set({ hydrated: value }),
  setPairSourceFilter: (value) => set({ pairSourceFilter: value }),
  setPassengerCounts: (value) => set(value),
  setReturnDate: (value) => set({ returnDate: value }),
  setRoundtripViewMode: (value) => set({ roundtripViewMode: value }),
  setSortDepart: (value) => set({ sortDepart: value }),
  setSortOneway: (value) => set({ sortOneway: value }),
  setSortReturn: (value) => set({ sortReturn: value }),
  setToSel: (value) => set({ toSel: value }),
  setTripType: (value) => set({ tripType: value }),
}));
