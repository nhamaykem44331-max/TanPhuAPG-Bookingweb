"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AirportLabelMap } from '@/components/flight/FlightRow';
import FloatingQuoteDock from '@/components/flight/FloatingQuoteDock';
import SiteGlobeHeader from '@/components/SiteGlobeHeader';
import OneWayResultsSection from '@/components/flight/OneWayResultsSection';
import RoundtripResultsSection from '@/components/flight/RoundtripResultsSection';
import HomeFooter from '@/components/home/HomeFooter';
import HomeSearchPanel from '@/components/home/HomeSearchPanel';
import type { AirportOption, AirportSelection, Cabin, FlightResult, RoundtripPairOption, SearchResponse } from '@/lib/types';
import { buildAirportSelection, legacyAirportCodeFromText, useAirports } from '@/lib/useAirports';
import { toYmd } from '@/lib/utils';
import { minFlightPrice } from '@/lib/flight-badges';
import { prefetchAncillaryResponse } from '@/lib/ancillary-cache';
import {
  DEFAULT_FROM_SEL,
  DEFAULT_TO_SEL,
  SEARCH_STATE_KEY,
  useHomeSearchStore,
} from '@/lib/homeSearchStore';
import { EMPTY_FILTER_STATE, applyFlightFilter, flightMatchesFilter, type FilterState } from '@/lib/flightFilters';
import {
  comparePairsByPrice,
  isBookablePair,
  mergeRoundtripPairs,
  pairDedupKey,
  pairOutboundSignature,
  pairSourceLabel,
  preferredRoundtripPairSourceFilter,
} from '@/lib/roundtrip';

const LOADING_HINTS = [
  'Đang kết nối với Tanphuapg.com',
  'Đang tìm chuyến bay giá tốt',
  'Đang so sánh và lọc kết quả',
  'Sắp xong rồi, vui lòng chờ',
];
const QUICK_ROUTE_CODES: Array<[string, string]> = [
  ['HAN', 'SGN'],
  ['HAN', 'DAD'],
  ['SGN', 'HAN'],
  ['HAN', 'PQC'],
  ['SGN', 'DAD'],
];
const VN_DOMESTIC_AIRPORT_CODES = new Set([
  'BMV', 'CAH', 'CXR', 'DAD', 'DIN', 'DLI', 'HAN', 'HPH', 'HUI', 'PQC',
  'PXU', 'SGN', 'TBB', 'THD', 'UIH', 'VCA', 'VCL', 'VCS', 'VDH', 'VDO',
  'VII', 'VKG',
]);

type FareBreakdown = { baseAmount:number; taxesFees:number; totalAmount:number; currency:'VND' };
type RoundtripMobileTab = 'outbound' | 'inbound';
type SearchDateOverrides = { date?: string; returnDate?: string; keepResults?: boolean };
type StreamState = {
  active: boolean;
  done: boolean;
  completed: number;
  total: number;
  timedOut: boolean;
  errors: Record<string, string>;
};

const INITIAL_PAIR_DISPLAY_LIMIT = 20;
const PAIR_LOAD_MORE_STEP = 20;
const INITIAL_FLIGHT_DISPLAY_LIMIT = 40;
const FLIGHT_LOAD_MORE_STEP = 40;
const STREAM_PAIR_BATCH_SIZE = 4;
const STREAM_PAIR_FLUSH_MS = 180;
const EMPTY_STREAM_STATE: StreamState = {
  active: false,
  done: false,
  completed: 0,
  total: 0,
  timedOut: false,
  errors: {},
};

function mergeFlightsById(existing: FlightResult[], incoming: FlightResult[]) {
  if (!incoming.length) return existing;
  const byId = new Map(existing.map((flight) => [flight.id, flight]));
  incoming.forEach((flight) => {
    if (!byId.has(flight.id)) byId.set(flight.id, flight);
  });
  return [...byId.values()].sort((a, b) => a.price.amount - b.price.amount);
}

function localTodayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizePassengerCounts(input: { adults: number; children: number; infants: number }) {
  let adults = Math.max(1, Math.min(9, Number(input.adults) || 1));
  let children = Math.max(0, Math.min(9, Number(input.children) || 0));
  let infants = Math.max(0, Math.min(4, Number(input.infants) || 0));

  if (infants > adults) infants = adults;

  let overflow = adults + children + infants - 9;
  if (overflow > 0) {
    const cutChildren = Math.min(children, overflow);
    children -= cutChildren;
    overflow -= cutChildren;
    if (overflow > 0) infants = Math.max(0, infants - overflow);
  }

  if (infants > adults) infants = adults;
  return { adults, children, infants };
}

function isDomesticAirportCode(code: string, domesticByCode: Map<string, boolean>) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return false;
  const known = domesticByCode.get(normalized);
  return known ?? VN_DOMESTIC_AIRPORT_CODES.has(normalized);
}

function effectiveRouteFilter(filter: FilterState, isDomesticRoute: boolean): FilterState {
  if (!isDomesticRoute && filter.duration === 'all') return filter;
  return {
    ...filter,
    stops: isDomesticRoute ? '0' : filter.stops,
    duration: 'all',
  };
}

// Main
export default function HomeSearchExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoSearchedRef = useRef(false);
  const { airports } = useAirports();
  const footerRef = useRef<HTMLElement | null>(null);
  const floatingQuoteDockRef = useRef<HTMLDivElement | null>(null);
  const todayYmd = useMemo(() => localTodayYmd(), []);
  const fromSel = useHomeSearchStore((state) => state.fromSel);
  const toSel = useHomeSearchStore((state) => state.toSel);
  const date = useHomeSearchStore((state) => state.date);
  const returnDate = useHomeSearchStore((state) => state.returnDate);
  const tripType = useHomeSearchStore((state) => state.tripType);
  const adults = useHomeSearchStore((state) => state.adults);
  const children = useHomeSearchStore((state) => state.children);
  const infants = useHomeSearchStore((state) => state.infants);
  const cabin = useHomeSearchStore((state) => state.cabin);
  const roundtripViewMode = useHomeSearchStore((state) => state.roundtripViewMode);
  const pairSourceFilter = useHomeSearchStore((state) => state.pairSourceFilter);
  const sortOneway = useHomeSearchStore((state) => state.sortOneway);
  const sortDepart = useHomeSearchStore((state) => state.sortDepart);
  const sortReturn = useHomeSearchStore((state) => state.sortReturn);
  const hydrated = useHomeSearchStore((state) => state.hydrated);
  const setFromSel = useHomeSearchStore((state) => state.setFromSel);
  const setToSel = useHomeSearchStore((state) => state.setToSel);
  const setDate = useHomeSearchStore((state) => state.setDate);
  const setReturnDate = useHomeSearchStore((state) => state.setReturnDate);
  const setTripType = useHomeSearchStore((state) => state.setTripType);
  const setCabin = useHomeSearchStore((state) => state.setCabin);
  const setRoundtripViewMode = useHomeSearchStore((state) => state.setRoundtripViewMode);
  const setPairSourceFilter = useHomeSearchStore((state) => state.setPairSourceFilter);
  const setSortOneway = useHomeSearchStore((state) => state.setSortOneway);
  const setSortDepart = useHomeSearchStore((state) => state.setSortDepart);
  const setSortReturn = useHomeSearchStore((state) => state.setSortReturn);
  const setPassengerCounts = useHomeSearchStore((state) => state.setPassengerCounts);
  const setHydrated = useHomeSearchStore((state) => state.setHydrated);
  const [loading, setLoading]   = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [resultsGen, setResultsGen]   = useState(0);
  const [searchedRoute, setSearchedRoute] = useState<{from:string;to:string;tripType:'oneway'|'roundtrip'}|null>(null);
  // Khi đã có ngữ cảnh tìm kiếm, form thu gọn thành thanh tóm tắt; bấm "Chọn lại" để mở lại.
  const [editingSearch, setEditingSearch] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const streamPairQueueRef = useRef<RoundtripPairOption[]>([]);
  const streamPairTimerRef = useRef<number | null>(null);
  const streamPairKeysRef = useRef<Set<string>>(new Set());
  const [error, setError]       = useState('');
  const [results, setResults]   = useState<FlightResult[]>([]);
  const [meta, setMeta]         = useState<SearchResponse['metadata']|null>(null);
  const [outboundResults, setOutboundResults] = useState<FlightResult[]>([]);
  const [inboundResults, setInboundResults]   = useState<FlightResult[]>([]);
  const [pairOptions, setPairOptions] = useState<RoundtripPairOption[]>([]);
  const [pairDisplayLimit, setPairDisplayLimit] = useState(INITIAL_PAIR_DISPLAY_LIMIT);
  const [onewayDisplayLimit, setOnewayDisplayLimit] = useState(INITIAL_FLIGHT_DISPLAY_LIMIT);
  const [outboundDisplayLimit, setOutboundDisplayLimit] = useState(INITIAL_FLIGHT_DISPLAY_LIMIT);
  const [inboundDisplayLimit, setInboundDisplayLimit] = useState(INITIAL_FLIGHT_DISPLAY_LIMIT);
  const [streamState, setStreamState] = useState<StreamState>(EMPTY_STREAM_STATE);
  const [selectedOutbound, setSelectedOutbound] = useState<FlightResult|null>(null);
  const [selectedInbound, setSelectedInbound]   = useState<FlightResult|null>(null);
  const [selectedOneway, setSelectedOneway]     = useState<FlightResult|null>(null);
  const [selectedPairId, setSelectedPairId] = useState('');
  const [mobileRoundtripTab, setMobileRoundtripTab] = useState<RoundtripMobileTab>('outbound');
  const [detailLoadingId, setDetailLoadingId] = useState<string|null>(null);
  const [loadingHintIdx, setLoadingHintIdx] = useState(0);
  const [loadingDots, setLoadingDots]       = useState('');
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean | null>(null);
  const [floatingQuoteDockBottom, setFloatingQuoteDockBottom] = useState(16);
  const [floatingQuoteDockHeight, setFloatingQuoteDockHeight] = useState(0);
  const [filterOneway,   setFilterOneway]   = useState<FilterState>(EMPTY_FILTER_STATE);
  const [filterOutbound, setFilterOutbound] = useState<FilterState>(EMPTY_FILTER_STATE);
  const [filterInbound,  setFilterInbound]  = useState<FilterState>(EMPTY_FILTER_STATE);

  const resolveSelection = (code: string, label: string, fallback: AirportSelection): AirportSelection => {
    return buildAirportSelection(airports, code || fallback.code, label || fallback.label) || fallback;
  };

  const quickRoutes = useMemo(() => QUICK_ROUTE_CODES.map(([from, to]) => ({
    from: buildAirportSelection(airports, from, from) || { code: from, label: from },
    to: buildAirportSelection(airports, to, to) || { code: to, label: to },
  })), [airports]);
  const airportLabelByCode = useMemo<AirportLabelMap>(() => {
    const labels: AirportLabelMap = {};
    airports.forEach((airport) => {
      labels[airport.code] = { city: airport.city, name: airport.name };
    });
    return labels;
  }, [airports]);
  const airportDomesticByCode = useMemo(() => {
    const map = new Map<string, boolean>();
    airports.forEach((airport) => {
      map.set(airport.code.toUpperCase(), !!airport.domestic);
    });
    return map;
  }, [airports]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEARCH_STATE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        const nextFrom = s?.fromSel?.code
          ? resolveSelection(String(s.fromSel.code || ''), String(s.fromSel.label || ''), DEFAULT_FROM_SEL)
          : resolveSelection(
              legacyAirportCodeFromText(String(s?.fromInput || '')) || String(s?.from || '') || DEFAULT_FROM_SEL.code,
              String(s?.fromInput || ''),
              DEFAULT_FROM_SEL,
            );
        const nextTo = s?.toSel?.code
          ? resolveSelection(String(s.toSel.code || ''), String(s.toSel.label || ''), DEFAULT_TO_SEL)
          : resolveSelection(
              legacyAirportCodeFromText(String(s?.toInput || '')) || String(s?.to || '') || DEFAULT_TO_SEL.code,
              String(s?.toInput || ''),
              DEFAULT_TO_SEL,
            );

        const pax = normalizePassengerCounts({
          adults: Number(s?.adults ?? 1),
          children: Number(s?.children ?? 0),
          infants: Number(s?.infants ?? 0),
        });

        setFromSel(nextFrom);
        setToSel(nextTo);
        setDate(String(s?.date || toYmd(7)));
        setReturnDate(String(s?.returnDate || ''));
        setTripType(s?.tripType === 'roundtrip' ? 'roundtrip' : 'oneway');
        setPassengerCounts(pax);
        setCabin((s?.cabin || 'economy') as Cabin);
        setRoundtripViewMode(s?.roundtripViewMode === 'pair' ? 'pair' : 'legs');
        setPairSourceFilter(String(s?.pairSourceFilter || 'all'));
        // Migration: nếu user còn state cũ với 'sortMode' duy nhất → áp cho cả 3 lane.
        const legacySort = s?.sortMode === 'time' ? 'time' : (s?.sortMode === 'price' ? 'price' : null);
        const pickSort = (raw: unknown): 'price' | 'time' =>
          raw === 'time' ? 'time' : raw === 'price' ? 'price' : (legacySort ?? 'price');
        setSortOneway(pickSort(s?.sortOneway));
        setSortDepart(pickSort(s?.sortDepart));
        setSortReturn(pickSort(s?.sortReturn));
      }
    } catch {
      /**/
    }

    // Cầu nối deep-link: nếu URL mang sẵn tiêu chí (link chatbot/chia sẻ gửi tới), ghi đè
    // state vừa nạp từ localStorage để autosearch (?go=1) chạy đúng chuyến khách hỏi.
    try {
      const sp = new URLSearchParams(window.location.search);
      const urlFrom = (sp.get('from') || '').trim().toUpperCase();
      const urlTo = (sp.get('to') || '').trim().toUpperCase();
      const urlDate = (sp.get('date') || '').trim();
      if (urlFrom && urlTo && urlDate) {
        setFromSel(resolveSelection(urlFrom, '', DEFAULT_FROM_SEL));
        setToSel(resolveSelection(urlTo, '', DEFAULT_TO_SEL));
        setDate(urlDate);
        const urlTrip = sp.get('tripType') === 'roundtrip' ? 'roundtrip' : 'oneway';
        setTripType(urlTrip);
        setReturnDate(urlTrip === 'roundtrip' ? (sp.get('returnDate') || '').trim() : '');
        setPassengerCounts(
          normalizePassengerCounts({
            adults: Number(sp.get('adults') ?? 1),
            children: Number(sp.get('children') ?? 0),
            infants: Number(sp.get('infants') ?? 0),
          }),
        );
        const urlCabin = sp.get('cabin');
        if (urlCabin === 'economy' || urlCabin === 'premium' || urlCabin === 'business' || urlCabin === 'first') {
          setCabin(urlCabin);
        }
      }
    } catch {
      /**/
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!airports.length) return;
    if (fromSel?.code) {
      const next = buildAirportSelection(airports, fromSel.code, fromSel.label);
      if (next && (next.code !== fromSel.code || next.label !== fromSel.label)) setFromSel(next);
    }
    if (toSel?.code) {
      const next = buildAirportSelection(airports, toSel.code, toSel.label);
      if (next && (next.code !== toSel.code || next.label !== toSel.label)) setToSel(next);
    }
  }, [airports, fromSel, setFromSel, setToSel, toSel]);

  // Autosearch: khi điều hướng từ landing với ?go=1, tự chạy tìm kiếm 1 lần
  // sau khi đã hydrate state từ localStorage và nạp xong danh sách sân bay.
  useEffect(() => {
    if (autoSearchedRef.current) return;
    if (searchParams?.get('go') !== '1') return;
    if (!hydrated || !airports.length) return;
    autoSearchedRef.current = true;
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, airports, searchParams]);

  // Fire-and-forget warm-up khi user vừa mở trang: backend sẽ kiểm tra/refresh
  // session và nạp tỷ giá trước. Giúp lần bấm "Tìm vé" đầu tiên khỏi gánh cold-login.
  // Dedup qua sessionStorage để reload/nav nội trang không gọi trùng.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const WARMED_KEY = 'apg_warmed_at';
    const WARMUP_TTL_MS = 60_000;
    try {
      const last = Number(sessionStorage.getItem(WARMED_KEY) || '0');
      if (Number.isFinite(last) && Date.now() - last < WARMUP_TTL_MS) return;
    } catch {/**/ }

    const started = Date.now();
    Promise.allSettled([
      fetch('/api/warmup', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('/api/exchange-rate', { cache: 'no-store' }),
    ]).then(([warm]) => {
      try { sessionStorage.setItem(WARMED_KEY, String(Date.now())); } catch {/**/ }
      if (warm.status === 'fulfilled' && warm.value) {
        const { ready, warming } = warm.value as { ready?: boolean; warming?: boolean };
        console.debug(`[warmup] ready=${ready} warming=${warming} elapsed=${Date.now() - started}ms`);
      }
    }).catch(() => {/* warmup never breaks UI */});
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(SEARCH_STATE_KEY, JSON.stringify({
        fromSel,
        toSel,
        from: fromSel?.code || '',
        to: toSel?.code || '',
        date,
        returnDate,
        tripType,
        adults,
        children,
        infants,
        cabin,
        roundtripViewMode,
        pairSourceFilter,
        sortOneway,
        sortDepart,
        sortReturn,
      }));
    } catch {/**/ }
  }, [hydrated, fromSel, toSel, date, returnDate, tripType, adults, children, infants, cabin, roundtripViewMode, pairSourceFilter, sortOneway, sortDepart, sortReturn]);

  useEffect(() => {
    if (!loading) { setLoadingHintIdx(0); setLoadingDots(''); return; }
    const dot  = setInterval(()=>setLoadingDots(d=>d.length>=3?'':d+'.'),350);
    const hint = setInterval(()=>setLoadingHintIdx(i=>(i+1)%LOADING_HINTS.length),1800);
    return ()=>{ clearInterval(dot); clearInterval(hint); };
  }, [loading]);

  function clearStreamPairQueue(resetKeys = false) {
    streamPairQueueRef.current = [];
    if (streamPairTimerRef.current !== null) {
      window.clearInterval(streamPairTimerRef.current);
      streamPairTimerRef.current = null;
    }
    if (resetKeys) streamPairKeysRef.current = new Set();
  }

  function flushQueuedStreamPairs() {
    const batch = streamPairQueueRef.current.splice(0, STREAM_PAIR_BATCH_SIZE);
    if (batch.length) {
      setPairOptions((prev) => mergeRoundtripPairs(prev, batch));
    }
    if (!streamPairQueueRef.current.length && streamPairTimerRef.current !== null) {
      window.clearInterval(streamPairTimerRef.current);
      streamPairTimerRef.current = null;
    }
  }

  function enqueueStreamPairs(pairs: RoundtripPairOption[]) {
    if (!pairs.length) return;
    const next = [...pairs].sort(comparePairsByPrice).filter((pair) => {
      const key = pairDedupKey(pair);
      if (streamPairKeysRef.current.has(key)) return false;
      streamPairKeysRef.current.add(key);
      return true;
    });
    if (!next.length) return;
    streamPairQueueRef.current.push(...next);
    flushQueuedStreamPairs();
    if (streamPairQueueRef.current.length && streamPairTimerRef.current === null) {
      streamPairTimerRef.current = window.setInterval(flushQueuedStreamPairs, STREAM_PAIR_FLUSH_MS);
    }
  }

  useEffect(() => () => clearStreamPairQueue(true), []);

  useEffect(() => {
    if (!meta) return;
    setMeta((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        totalResults: Math.max(Number(prev.totalResults || 0), pairOptions.length || results.length),
        pairCount: Math.max(Number(prev.pairCount || 0), pairOptions.length),
        loadedPairCount: pairOptions.length,
        displayedPairCount: Math.min(pairOptions.length, pairDisplayLimit),
      };
      return (
        prev.totalResults === next.totalResults &&
        prev.pairCount === next.pairCount &&
        prev.loadedPairCount === next.loadedPairCount &&
        prev.displayedPairCount === next.displayedPairCount
      ) ? prev : next;
    });
  }, [pairOptions.length, pairDisplayLimit, results.length]);

  useEffect(() => {
    const desktopMedia = window.matchMedia('(min-width: 1024px)');
    const mobileMedia = window.matchMedia('(max-width: 767px)');
    const syncViewport = () => {
      setIsDesktopViewport(desktopMedia.matches);
      setIsMobileViewport(mobileMedia.matches);
    };

    syncViewport();
    desktopMedia.addEventListener('change', syncViewport);
    mobileMedia.addEventListener('change', syncViewport);

    return () => {
      desktopMedia.removeEventListener('change', syncViewport);
      mobileMedia.removeEventListener('change', syncViewport);
    };
  }, []);

  function sortFlights(arr:FlightResult[], mode:'price'|'time'='price') {
    const copy=[...arr];
    if (mode==='time') copy.sort((a,b)=>+new Date(a.departure.time)-+new Date(b.departure.time));
    else copy.sort((a,b)=>a.price.amount-b.price.amount);
    return copy;
  }

  function sortPairResults(arr: RoundtripPairOption[], mode:'price'|'time'='price') {
    const copy = [...arr];
    if (mode === 'time') copy.sort((a, b) => +new Date(a.outbound.departure.time) - +new Date(b.outbound.departure.time));
    else copy.sort(comparePairsByPrice);
    return copy;
  }

  const fromCode = fromSel?.code || '';
  const toCode = toSel?.code || '';
  const isDomesticRoute = useMemo(
    () => isDomesticAirportCode(fromCode, airportDomesticByCode) && isDomesticAirportCode(toCode, airportDomesticByCode),
    [airportDomesticByCode, fromCode, toCode]
  );
  const effectiveFilterOneway = useMemo(() => effectiveRouteFilter(filterOneway, isDomesticRoute), [filterOneway, isDomesticRoute]);
  const effectiveFilterOutbound = useMemo(() => effectiveRouteFilter(filterOutbound, isDomesticRoute), [filterOutbound, isDomesticRoute]);
  const effectiveFilterInbound = useMemo(() => effectiveRouteFilter(filterInbound, isDomesticRoute), [filterInbound, isDomesticRoute]);

  const sortedOneway   = useMemo(()=>applyFlightFilter(sortFlights(results, sortOneway),effectiveFilterOneway),[results,sortOneway,effectiveFilterOneway]);
  const visibleOneway = useMemo(() => sortedOneway.slice(0, onewayDisplayLimit), [sortedOneway, onewayDisplayLimit]);
  const sortedOutbound = useMemo(() => {
    if (tripType === 'roundtrip' && roundtripViewMode === 'pair' && pairOptions.length > 0) return [];
    return applyFlightFilter(sortFlights(outboundResults, sortDepart), effectiveFilterOutbound);
  }, [tripType, roundtripViewMode, pairOptions.length, outboundResults, sortDepart, effectiveFilterOutbound]);
  const visibleOutbound = useMemo(() => sortedOutbound.slice(0, outboundDisplayLimit), [sortedOutbound, outboundDisplayLimit]);
  const sortedInbound  = useMemo(() => {
    if (tripType === 'roundtrip' && roundtripViewMode === 'pair' && pairOptions.length > 0) return [];
    return applyFlightFilter(sortFlights(inboundResults, sortReturn), effectiveFilterInbound);
  }, [tripType, roundtripViewMode, pairOptions.length, inboundResults, sortReturn, effectiveFilterInbound]);
  const visibleInbound = useMemo(() => sortedInbound.slice(0, inboundDisplayLimit), [sortedInbound, inboundDisplayLimit]);
  const pairSources = useMemo(() => {
    if (tripType !== 'roundtrip' || pairOptions.length === 0) return [];
    const counts = new Map<string, number>();
    pairOptions.forEach((pair) => {
      const source = pairSourceLabel(pair.source || pair.systemName);
      if (!source) return;
      counts.set(source, (counts.get(source) || 0) + 1);
    });
    return [...counts.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => a.source.localeCompare(b.source));
  }, [tripType, pairOptions]);
  const sourceScopedPairOptions = useMemo(() => {
    if (tripType !== 'roundtrip' || pairOptions.length === 0) return [];
    return pairSourceFilter === 'all'
      ? pairOptions
      : pairOptions.filter((pair) => pairSourceLabel(pair.source || pair.systemName) === pairSourceFilter);
  }, [tripType, pairOptions, pairSourceFilter]);
  const pairFilterScopedOptions = useMemo(() => {
    if (tripType !== 'roundtrip' || sourceScopedPairOptions.length === 0) return [];
    return sourceScopedPairOptions.filter((pair) =>
      flightMatchesFilter(pair.outbound, effectiveFilterOutbound) &&
      flightMatchesFilter(pair.inbound, effectiveFilterInbound)
    );
  }, [tripType, sourceScopedPairOptions, effectiveFilterOutbound, effectiveFilterInbound]);
  const pairFilterOutboundFlights = useMemo(
    () => sourceScopedPairOptions.map((pair) => pair.outbound),
    [sourceScopedPairOptions]
  );
  const pairFilterInboundFlights = useMemo(
    () => sourceScopedPairOptions.map((pair) => pair.inbound),
    [sourceScopedPairOptions]
  );
  const pairAnchorSignature = useMemo(() => {
    if (tripType !== 'roundtrip' || pairSourceFilter === 'all' || pairFilterScopedOptions.length === 0) return '';
    const selectedSignature = pairOutboundSignature(selectedOutbound);
    if (selectedSignature && pairFilterScopedOptions.some((pair) => pairOutboundSignature(pair.outbound) === selectedSignature)) {
      return selectedSignature;
    }

    const directPairs = pairFilterScopedOptions.filter((pair) => Number(pair.outbound.stops || 0) === 0);
    const pool = directPairs.length ? directPairs : pairFilterScopedOptions;
    const anchor = [...pool].sort((a, b) => {
      const outboundAmountA = Number(a.outbound.fareBreakdown?.totalAmount ?? a.outbound.price.amount ?? a.totalAmount);
      const outboundAmountB = Number(b.outbound.fareBreakdown?.totalAmount ?? b.outbound.price.amount ?? b.totalAmount);
      if (outboundAmountA !== outboundAmountB) return outboundAmountA - outboundAmountB;
      if (a.totalAmount !== b.totalAmount) return a.totalAmount - b.totalAmount;
      return +new Date(a.outbound.departure.time) - +new Date(b.outbound.departure.time);
    })[0];
    return pairOutboundSignature(anchor?.outbound);
  }, [tripType, pairSourceFilter, pairFilterScopedOptions, selectedOutbound]);
  const pairAnchorFlight = useMemo(() => {
    if (!pairAnchorSignature) return null;
    return pairFilterScopedOptions.find((pair) => pairOutboundSignature(pair.outbound) === pairAnchorSignature)?.outbound || null;
  }, [pairFilterScopedOptions, pairAnchorSignature]);
  const displayablePairOptions = useMemo(() => {
    if (tripType !== 'roundtrip' || pairOptions.length === 0) return [];
    let filtered = pairFilterScopedOptions;
    if (pairAnchorSignature) {
      const anchored = filtered.filter((pair) => pairOutboundSignature(pair.outbound) === pairAnchorSignature);
      if (anchored.length) filtered = anchored;
    }
    // Pair view neo theo chiều đi nên dùng sort của chiều đi.
    return sortPairResults(filtered, sortDepart);
  }, [tripType, pairOptions, pairFilterScopedOptions, pairAnchorSignature, sortDepart]);
  const visiblePairOptions = useMemo(
    () => displayablePairOptions.slice(0, pairDisplayLimit),
    [displayablePairOptions, pairDisplayLimit]
  );
  const hasMorePairOptions = displayablePairOptions.length > visiblePairOptions.length;
  const totalPairCount = meta?.pairCount ?? pairOptions.length;
  const pairLoadedNotice = totalPairCount > pairOptions.length ? ` · tổng ${totalPairCount} cặp` : '';
  const streamErrorCount = Object.keys(streamState.errors).length;
  const streamProgressLabel = streamState.total > 0
    ? `${Math.min(streamState.completed, streamState.total)}/${streamState.total} nguồn`
    : 'đang kết nối nguồn';
  const streamStatusLabel = streamState.active
    ? `Đã có ${pairOptions.length} cặp · đang tải thêm (${streamProgressLabel})`
    : streamState.timedOut
      ? `Đã tải phần khả dụng · ${pairOptions.length} cặp`
      : streamState.done && pairOptions.length > 0
        ? `Đã tải xong ${pairOptions.length} cặp`
        : '';
  const totalRoundtrip = useMemo(()=>(selectedOutbound?.fareBreakdown?.totalAmount??selectedOutbound?.price.amount??0)+(selectedInbound?.fareBreakdown?.totalAmount??selectedInbound?.price.amount??0),[selectedOutbound,selectedInbound]);
  const totalOneway = useMemo(()=>selectedOneway?.fareBreakdown?.totalAmount??selectedOneway?.price.amount??0,[selectedOneway]);
  const onewayDailyMinPrice = useMemo(() => minFlightPrice(results), [results]);
  const outboundDailyMinPrice = useMemo(
    () => minFlightPrice(outboundResults.length ? outboundResults : pairOptions.map((pair) => pair.outbound)),
    [outboundResults, pairOptions]
  );
  const inboundDailyMinPrice = useMemo(
    () => minFlightPrice(inboundResults.length ? inboundResults : pairOptions.map((pair) => pair.inbound)),
    [inboundResults, pairOptions]
  );
  const minReturnDate = useMemo(() => (date && date > todayYmd ? date : todayYmd), [date, todayYmd]);
  const defaultReturnDate = useMemo(() => {
    const fallback = toYmd(10);
    return fallback >= minReturnDate ? fallback : minReturnDate;
  }, [minReturnDate]);
  useEffect(() => {
    if (!date || date < todayYmd) setDate(todayYmd);
  }, [date, todayYmd]);

  useEffect(() => {
    if (returnDate && returnDate < minReturnDate) setReturnDate(minReturnDate);
  }, [returnDate, minReturnDate]);

  useEffect(() => {
    if (pairSourceFilter === 'all') return;
    if (!pairSources.some((item) => item.source === pairSourceFilter)) {
      setPairSourceFilter('all');
    }
  }, [pairSourceFilter, pairSources]);

  useEffect(() => {
    setPairDisplayLimit(INITIAL_PAIR_DISPLAY_LIMIT);
  }, [pairSourceFilter, sortDepart, roundtripViewMode, filterOutbound, filterInbound]);

  useEffect(() => {
    setOnewayDisplayLimit(INITIAL_FLIGHT_DISPLAY_LIMIT);
  }, [resultsGen, sortOneway, filterOneway, tripType]);

  useEffect(() => {
    setOutboundDisplayLimit(INITIAL_FLIGHT_DISPLAY_LIMIT);
  }, [resultsGen, sortDepart, filterOutbound, tripType, roundtripViewMode]);

  useEffect(() => {
    setInboundDisplayLimit(INITIAL_FLIGHT_DISPLAY_LIMIT);
  }, [resultsGen, sortReturn, filterInbound, tripType, roundtripViewMode]);

  const applyPassengerCounts = (next: { adults: number; children: number; infants: number }) => {
    const normalized = normalizePassengerCounts(next);
    setPassengerCounts(normalized);
  };

  // Prefetch ancillaries (hành lý) ngay khi user đã chọn đủ chuyến trên /search.
  // Khi qua /quote → bấm "Giữ chỗ" → modal có data sẵn (cache 120s in-memory).
  // Throttle: chỉ trigger khi state ổn định 350ms để tránh prefetch khi user đang spam click.
  useEffect(() => {
    if (!fromCode || !toCode) return;

    let payload: Parameters<typeof prefetchAncillaryResponse>[0] | null = null;

    if (tripType === 'oneway' && selectedOneway) {
      payload = {
        flight: selectedOneway,
        outbound: selectedOneway,
        inbound: null,
        tripType: 'oneway',
        search: { from: fromCode, to: toCode, date },
        adults, children, infants, cabin,
      };
    } else if (tripType === 'roundtrip' && selectedOutbound && selectedInbound) {
      payload = {
        flight: selectedOutbound,
        outbound: selectedOutbound,
        inbound: selectedInbound,
        tripType: 'roundtrip',
        search: { from: fromCode, to: toCode, date, returnDate: returnDate || toYmd(10) },
        adults, children, infants, cabin,
      };
    }

    if (!payload) return;
    const captured = payload;
    const t = window.setTimeout(() => prefetchAncillaryResponse(captured), 350);
    return () => window.clearTimeout(t);
  }, [tripType, selectedOneway, selectedOutbound, selectedInbound, fromCode, toCode, date, returnDate, adults, children, infants, cabin]);

  function goQuote(outbound:FlightResult, inbound?:FlightResult) {
    const createdAt = new Date().toISOString();
    // Một mã tham chiếu duy nhất cho cả /quote (báo giá) và /dat-cho (đặt vé).
    const quoteCode = `APG-${new Date(createdAt).getTime().toString(36).toUpperCase().slice(-6)}`;
    localStorage.setItem('apg_quote_selection', JSON.stringify({
      tripType: inbound ? 'roundtrip' : 'oneway',
      outbound,
      inbound,
      adults,
      children,
      infants,
      cabin,
      search: { from: fromCode, to: toCode, date, returnDate: returnDate || toYmd(10) },
      searchExpiresAt: meta?.expiresAt,
      createdAt,
      quoteCode,
    }));
    router.push('/dat-cho');
  }

  function selectRoundtripPair(pair: RoundtripPairOption) {
    if (!isBookablePair(pair)) {
      setError('Cặp này đang hoàn tất dữ liệu đặt chỗ, vui lòng chọn cặp khác hoặc chờ thêm một chút.');
      return;
    }
    setError('');
    setSelectedPairId(pair.id);
    setSelectedOutbound(pair.outbound);
    setSelectedInbound(pair.inbound);
    // Bỏ auto-navigate — user phải bấm thủ công "Tiếp tục báo giá"
  }

  async function selectFlight(flight:FlightResult, dir:'outbound'|'inbound'|'oneway') {
    setDetailLoadingId(flight.id);
    if (dir !== 'oneway') setSelectedPairId('');
    try {
      let e={...flight};
      if (!e.fareBreakdown && e.detailUrl) {
        try {
          const r=await fetch('/api/fare-detail',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({detailUrl:e.detailUrl})});
          const j=await r.json();
          if(r.ok&&j.fareBreakdown){const fb=j.fareBreakdown as FareBreakdown;e={...e,fareBreakdown:fb,price:{...e.price,amount:fb.totalAmount}};}
        } catch {/**/ }
      }
      if (!e.fareBreakdown) e={...e,fareBreakdown:{baseAmount:e.price.amount,taxesFees:0,totalAmount:e.price.amount,currency:'VND'}};
      // Bỏ auto-navigate sang báo giá — user vẫn bấm thủ công "Tiếp tục báo giá".
      if (dir==='outbound'){setOutboundResults(p=>p.map(f=>f.id===flight.id?e:f));setSelectedOutbound(e);setMobileRoundtripTab('inbound');}
      else if(dir==='inbound'){setInboundResults(p=>p.map(f=>f.id===flight.id?e:f));setSelectedInbound(e);}
      else {setResults(p=>p.map(f=>f.id===flight.id?e:f));setSelectedOneway(e);}
    } catch(ex:unknown){setError(ex instanceof Error?ex.message:'Lỗi');}
    finally{setDetailLoadingId(null);}
  }

  async function callSearch(payload:Record<string,unknown>, signal?: AbortSignal):Promise<SearchResponse> {
    const r=await fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
    const j=await r.json();
    if(!r.ok)throw new Error(j.details ? `${j.error}: ${j.details}` : (j.error||'Lỗi'));
    return j as SearchResponse;
  }

  async function callSearchStream(payload: Record<string, unknown>, signal?: AbortSignal): Promise<boolean> {
    const startedAt = Date.now();
    let receivedAnyPayload = false;
    let streamNotSupported = false;

    const res = await fetch('/api/search/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok || !res.body) {
      setStreamState(EMPTY_STREAM_STATE);
      return false;
    }

    setStreamState({ ...EMPTY_STREAM_STATE, active: true });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const baseMeta = (): SearchResponse['metadata'] => ({
      totalResults: 0,
      departureCount: 0,
      returnCount: 0,
      pairCount: 0,
      displayedResultCount: 0,
      displayedDepartureCount: 0,
      displayedReturnCount: 0,
      displayedPairCount: 0,
      loadedPairCount: 0,
      journeyType: 'RT',
      searchTime: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
      cached: false,
      sourceUsed: 'namthanh',
      engine: 'MuadiDirectStream',
    });

    try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        const eventLine = block.split('\n').find((line) => line.startsWith('event:'));
        const dataLine = block.split('\n').find((line) => line.startsWith('data:'));
        if (!dataLine) continue;

        let event: {
          type?: string;
          airline?: string;
          searchId?: string;
          results?: FlightResult[];
          departureResults?: FlightResult[];
          returnResults?: FlightResult[];
          pairOptions?: RoundtripPairOption[];
          completedCount?: number;
          totalCount?: number;
          airlines?: string[];
          error?: string;
          expiresAt?: string;
        };
        try {
          event = JSON.parse(dataLine.slice(5).trim());
        } catch {
          continue;
        }

        if (eventLine?.includes('error') || event.error) {
          if (event.error === 'STREAM_NOT_SUPPORTED') {
            streamNotSupported = true;
            break;
          }
          if (receivedAnyPayload) {
            setStreamState((prev) => ({ ...prev, active: false, done: true, timedOut: true }));
            return true;
          }
          throw new Error(event.error || 'Lỗi streaming');
        }

        if (event.type === 'session') {
          setStreamState((prev) => ({
            ...prev,
            active: true,
            done: false,
            completed: 0,
            total: event.airlines?.length ?? 0,
          }));
          setMeta((prev) => {
            const base = prev || baseMeta();
            // Bắt expiry phiên tìm kiếm nếu stream gửi kèm → đồng hồ giữ chỗ phản ánh TTL thật
            // (nếu không có thì rơi về mặc định phẳng 10 phút).
            return event.expiresAt ? { ...base, expiresAt: event.expiresAt } : base;
          });
          continue;
        }

        if (event.type === 'airline_result') {
          receivedAnyPayload = true;
          const incomingResults = event.results || [];
          const incomingDeparture = event.departureResults || [];
          const incomingReturn = event.returnResults || [];
          const incomingPairs = event.pairOptions || [];

          setResults((prev) => mergeFlightsById(prev, incomingResults));
          setOutboundResults((prev) => mergeFlightsById(prev, incomingDeparture));
          setInboundResults((prev) => mergeFlightsById(prev, incomingReturn));
          if (incomingPairs.length) {
            setRoundtripViewMode('pair');
            enqueueStreamPairs(incomingPairs);
          }

          setStreamState((prev) => ({
            ...prev,
            active: true,
            done: false,
            completed: event.completedCount ?? prev.completed,
            total: event.totalCount ?? prev.total,
          }));
          setMeta((prev) => {
            const searchTime = Number(((Date.now() - startedAt) / 1000).toFixed(2));
            if (prev?.searchTime === searchTime) return prev;
            return {
              ...(prev || baseMeta()),
              searchTime,
            };
          });
          continue;
        }

        if (event.type === 'airline_error') {
          setStreamState((prev) => ({
            ...prev,
            active: true,
            completed: event.completedCount ?? prev.completed,
            total: event.totalCount ?? prev.total,
            errors: {
              ...prev.errors,
              [event.airline || `source-${Object.keys(prev.errors).length + 1}`]: event.error || 'Lỗi nguồn',
            },
          }));
          continue;
        }

        if (event.type === 'done') {
          setStreamState((prev) => ({
            ...prev,
            active: false,
            done: true,
            completed: event.completedCount ?? prev.completed,
            total: event.totalCount ?? prev.total,
          }));
          return true;
        }
      }

      if (streamNotSupported) {
        setStreamState(EMPTY_STREAM_STATE);
        return false;
      }
    }

    } finally {
      // Giải phóng kết nối SSE phía browser trên mọi lối thoát (done/abort/lỗi).
      try { await reader.cancel(); } catch { /* reader đã đóng */ }
    }

    setStreamState((prev) => ({ ...prev, active: false, done: true }));
    return receivedAnyPayload;
  }

  async function search(overrides: SearchDateOverrides = {}) {
    const searchDate = overrides.date ?? date;
    const searchReturnDate = overrides.returnDate ?? returnDate;
    const keepResults = !!overrides.keepResults;
    setEditingSearch(false); // tìm xong → thu gọn form lại

    // Hủy fetch trước đó nếu user đổi ngày liên tục → tránh race condition
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    if (keepResults) {
      // Stale-while-revalidate: KHÔNG clear list cũ, chỉ bật cờ reloading
      setIsReloading(true);
      setError('');
      clearStreamPairQueue();
      streamPairKeysRef.current = new Set(pairOptions.map(pairDedupKey));
      setStreamState(EMPTY_STREAM_STATE);
    } else {
      setLoading(true);setError('');setResults([]);setMeta(null);
      setOutboundResults([]);setInboundResults([]);setPairOptions([]);
      setSelectedOutbound(null);setSelectedInbound(null);setSelectedOneway(null);setSelectedPairId('');setPairSourceFilter('all');setMobileRoundtripTab('outbound');
      setFilterOneway(EMPTY_FILTER_STATE);setFilterOutbound(EMPTY_FILTER_STATE);setFilterInbound(EMPTY_FILTER_STATE);
      setPairDisplayLimit(INITIAL_PAIR_DISPLAY_LIMIT);
      setStreamState(EMPTY_STREAM_STATE);
      clearStreamPairQueue(true);
    }
    try {
      if (!fromCode || !toCode) throw new Error('Vui lòng chọn sân bay đi và sân bay đến hợp lệ.');
      if (fromCode === toCode) throw new Error('Điểm đi và điểm đến không được giống nhau.');
      if (searchDate < todayYmd) throw new Error('Ngày đi phải từ hôm nay trở đi.');
      if (infants > adults) throw new Error('Số em bé không được vượt quá số người lớn.');
      if (adults + children + infants > 9) throw new Error('Tổng số hành khách tối đa 9.');
      const base={adults,children,infants,cabin};
      setSearchedRoute({ from: fromCode, to: toCode, tripType });
      if (tripType==='roundtrip') {
        const eff=searchReturnDate||toYmd(10);
        if (eff < searchDate) throw new Error('Ngày về phải từ ngày đi trở đi.');
        const searchPayload = {...base,from:fromCode,to:toCode,date:searchDate,returnDate:eff,tripType:'roundtrip'};
        const streamed = await callSearchStream(searchPayload, controller.signal);
        if (controller.signal.aborted) return;
        if (!streamed) {
          const rt=await callSearch(searchPayload, controller.signal);
          if (controller.signal.aborted) return;
          const hasRoundtripShape = Array.isArray(rt.departureResults) || Array.isArray(rt.returnResults) || Array.isArray(rt.pairOptions);
          if (hasRoundtripShape) {
            const departure = Array.isArray(rt.departureResults) ? rt.departureResults : rt.results || [];
            const returns = Array.isArray(rt.returnResults) ? rt.returnResults : [];
            const pairs = Array.isArray(rt.pairOptions) ? rt.pairOptions : [];
            setOutboundResults(departure);
            setInboundResults(returns);
            setPairOptions(mergeRoundtripPairs([], pairs));
            setRoundtripViewMode(pairs.length > 0 ? 'pair' : 'legs');
            if (!keepResults) setPairSourceFilter(preferredRoundtripPairSourceFilter(pairs));
            setMeta(rt.metadata || null);
            // Validate selection cũ còn tồn tại trong data mới
            if (keepResults) {
              setSelectedOutbound(prev => prev && departure.find(f => f.id === prev.id) ? prev : null);
              setSelectedInbound(prev => prev && returns.find(f => f.id === prev.id) ? prev : null);
              if (pairs.length === 0) setSelectedPairId('');
            }
          } else {
            const go=await callSearch({...base,from:fromCode,to:toCode,date:searchDate,tripType:'oneway'}, controller.signal);
            if (controller.signal.aborted) return;
            const back=await callSearch({...base,from:toCode,to:fromCode,date:eff,tripType:'oneway'}, controller.signal);
            if (controller.signal.aborted) return;
            const goResults = go.results||[];
            const backResults = back.results||[];
            setOutboundResults(goResults);setInboundResults(backResults);
            setMeta({
              totalResults: goResults.length + backResults.length,
              departureCount: goResults.length,
              returnCount: backResults.length,
              searchTime: +(((go.metadata?.searchTime || 0) + (back.metadata?.searchTime || 0))).toFixed(1),
            });
            setRoundtripViewMode('legs');
            if (keepResults) {
              setSelectedOutbound(prev => prev && goResults.find(f => f.id === prev.id) ? prev : null);
              setSelectedInbound(prev => prev && backResults.find(f => f.id === prev.id) ? prev : null);
            }
          }
        }
      } else {
        const one=await callSearch({...base,from:fromCode,to:toCode,date:searchDate,tripType:'oneway'}, controller.signal);
        if (controller.signal.aborted) return;
        const oneResults = one.results||[];
        setResults(oneResults);setMeta(one.metadata || null);
        if (keepResults) {
          setSelectedOneway(prev => prev && oneResults.find(f => f.id === prev.id) ? prev : null);
        }
      }
      // Ghi nhận chặng vừa search xong để biết kết quả hiện tại thuộc route nào
      setSearchedRoute({ from: fromCode, to: toCode, tripType });
      // Trigger animation re-fire khi có data mới (cả search lần đầu lẫn đổi ngày)
      setResultsGen(g => g + 1);
    } catch(ex:unknown){
      if (ex instanceof DOMException && ex.name === 'AbortError') return;
      setError(ex instanceof Error?ex.message:'Lỗi tìm kiếm.');
    }
    finally{
      if (!controller.signal.aborted) {
        setLoading(false);
        setIsReloading(false);
      }
    }
  }

  const hasResults = tripType==='oneway'
    ? results.length>0
    : (outboundResults.length>0||inboundResults.length>0||pairOptions.length>0);

  // Kết quả hiện tại có khớp với form đang nhập không?
  // Mismatch (đổi sân bay / đổi tripType) → render skeleton thay vì list cũ.
  // Đổi ngày KHÔNG ảnh hưởng đến match (date dùng SWR riêng giữ list cũ).
  const routeMatchesResults = !!searchedRoute
    && searchedRoute.from === fromCode
    && searchedRoute.to === toCode
    && searchedRoute.tripType === tripType;
  const showFloatingQuoteDock = routeMatchesResults
    && (
      (tripType === 'oneway' && !!selectedOneway) ||
      (tripType === 'roundtrip' && !!selectedOutbound && !!selectedInbound)
    );

  // Đổi ngày → bỏ lựa chọn cũ: chuyến của ngày cũ không còn hợp lệ cho ngày mới.
  // Quan trọng vì nhánh tìm kiếm streaming không chạy lại bước validate selection, nên nếu
  // không xóa, dock vẫn hiện chuyến cũ và "Tiếp tục đặt vé" sẽ mang nhầm chuyến sai ngày.
  function clearFlightSelections() {
    setSelectedOneway(null);
    setSelectedOutbound(null);
    setSelectedInbound(null);
    setSelectedPairId('');
  }

  function selectDepartDate(nextDate: string) {
    const adjustedReturnDate = tripType === 'roundtrip' && returnDate && returnDate < nextDate ? nextDate : returnDate;

    setDate(nextDate);
    if (adjustedReturnDate !== returnDate) setReturnDate(adjustedReturnDate);
    clearFlightSelections();
    if (hasResults) void search({ date: nextDate, returnDate: adjustedReturnDate, keepResults: true });
  }

  function selectReturnDate(nextDate: string) {
    setReturnDate(nextDate);
    clearFlightSelections();
    if (hasResults) void search({ returnDate: nextDate, keepResults: true });
  }

  useEffect(() => {
    if (!showFloatingQuoteDock) {
      setFloatingQuoteDockHeight(0);
      return;
    }

    const node = floatingQuoteDockRef.current;
    if (!node) return;

    const syncHeight = () => {
      setFloatingQuoteDockHeight(node.getBoundingClientRect().height);
    };

    syncHeight();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(syncHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [showFloatingQuoteDock, tripType, selectedOneway, selectedOutbound, selectedInbound, adults, children, infants, totalOneway, totalRoundtrip]);

  useEffect(() => {
    if (!showFloatingQuoteDock) {
      setFloatingQuoteDockBottom(16);
      return;
    }

    let frame = 0;
    const baseGap = isDesktopViewport ? 20 : 12;

    const syncBottom = () => {
      frame = 0;
      if (typeof window === 'undefined') return;
      const footerTop = footerRef.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
      const overlap = Math.max(0, window.innerHeight - footerTop);
      setFloatingQuoteDockBottom(baseGap + overlap);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(syncBottom);
    };

    syncBottom();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [showFloatingQuoteDock, isDesktopViewport]);

  // Đã có ngữ cảnh tìm (đến từ landing ?go=1 hoặc đã tìm) + không đang sửa → thu gọn form.
  const cameFromLanding = searchParams?.get('go') === '1';
  const searchCollapsed = (!!searchedRoute || cameFromLanding) && !editingSearch;

  return (
    <main className="apgx min-h-screen" style={{ backgroundColor: 'var(--apg-bg-page)' }}>
        <SiteGlobeHeader
          right={searchCollapsed ? (
            <button
              type="button"
              aria-label="Chọn lại chuyến bay"
              onClick={() => { setEditingSearch(true); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-white/20"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>
              <span>Đổi</span>
            </button>
          ) : undefined}
        />

        {searchCollapsed ? (
          <>
            {loading && !hasResults && (
              <div className="mx-auto w-full max-w-[1320px] px-4 pt-6 text-center text-sm text-[var(--apg-text-secondary)] lg:px-7">Đang tìm chuyến bay…</div>
            )}
          </>
        ) : (
          /* Search form (design header navy is inside HomeSearchPanel) */
          <HomeSearchPanel
            adults={adults}
            airports={airports}
            cabin={cabin}
            children={children}
            date={date}
            defaultReturnDate={defaultReturnDate}
            error={error}
            fromSel={fromSel}
            infants={infants}
            isDesktopViewport={isDesktopViewport}
            isReloading={isReloading}
            loading={loading}
            loadingHintText={`${LOADING_HINTS[loadingHintIdx]}${loadingDots}`}
            minReturnDate={minReturnDate}
            quickRoutes={quickRoutes}
            returnDate={returnDate}
            todayYmd={todayYmd}
            toSel={toSel}
            tripType={tripType}
            showHero={!hasResults}
            onCabinChange={setCabin}
            onDateChange={setDate}
            onFromSelect={setFromSel}
            onPassengerCountsChange={applyPassengerCounts}
            onQuickRouteSelect={(from, to) => { setFromSel(from); setToSel(to); }}
            onReturnDateChange={setReturnDate}
            onSearch={() => search()}
            onSwapRoute={() => { const currentFrom = fromSel; setFromSel(toSel); setToSel(currentFrom); }}
            onToSelect={setToSel}
            onTripTypeChange={(nextTripType) => {
              setTripType(nextTripType);
              if (nextTripType === 'roundtrip' && !returnDate) setReturnDate(defaultReturnDate);
            }}
          />
        )}

        <div className="mx-auto w-full max-w-[1320px] px-4 pb-8 lg:px-7">
        {/* Empty state — tìm xong cho đúng chặng hiện tại nhưng không có chuyến nào */}
        {routeMatchesResults && !loading && !isReloading && !error && !hasResults && (
          <div className="mx-auto mt-2 max-w-xl rounded-2xl border border-[var(--apg-border-default)] bg-white px-6 py-10 text-center shadow-sm">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--apg-bg-surface-soft)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--apg-aviation-navy)" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            </div>
            <h3 className="text-[16px] font-bold text-[var(--apg-aviation-navy)]">Không tìm thấy chuyến bay phù hợp</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--apg-text-secondary)]">Chặng <b>{searchedRoute?.from} → {searchedRoute?.to}</b> chưa có chuyến cho ngày bạn chọn. Hãy thử đổi ngày bay hoặc kiểm tra lại sân bay.</p>
          </div>
        )}
        {/* One-way results */}
        {tripType==='oneway' && results.length>0 && (
          <OneWayResultsSection
            airportLabels={airportLabelByCode}
            dailyMinPrice={onewayDailyMinPrice}
            date={date}
            filter={filterOneway}
            flightLoadMoreStep={FLIGHT_LOAD_MORE_STEP}
            fromCode={fromCode}
            isDesktopViewport={isDesktopViewport}
            isDomesticRoute={isDomesticRoute}
            isReloading={isReloading}
            metaSearchTime={meta?.searchTime}
            results={results}
            resultsGen={resultsGen}
            routeMatchesResults={routeMatchesResults}
            selectedFlight={selectedOneway}
            sortMode={sortOneway}
            sortedFlights={sortedOneway}
            toCode={toCode}
            visibleFlights={visibleOneway}
            onClearSelected={() => setSelectedOneway(null)}
            onContinue={() => { if (selectedOneway) goQuote(selectedOneway); }}
            selectionTotal={totalOneway}
            onFilterChange={setFilterOneway}
            onLoadMore={() => setOnewayDisplayLimit((value) => value + FLIGHT_LOAD_MORE_STEP)}
            onSelectDate={selectDepartDate}
            onSelectFlight={(flight) => selectFlight(flight, 'oneway')}
            onSortChange={setSortOneway}
          />
        )}

        {/* Roundtrip - 2 c?t nh? Abay */}
        {tripType==='roundtrip' && (outboundResults.length>0||inboundResults.length>0||pairOptions.length>0) && (
          <RoundtripResultsSection
            airportLabels={airportLabelByCode}
            date={date}
            displayablePairCount={displayablePairOptions.length}
            filterInbound={filterInbound}
            filterOutbound={filterOutbound}
            flightLoadMoreStep={FLIGHT_LOAD_MORE_STEP}
            fromCode={fromCode}
            hasMorePairOptions={hasMorePairOptions}
            inboundDailyMinPrice={inboundDailyMinPrice}
            inboundResults={inboundResults}
            isDesktopViewport={isDesktopViewport}
            isDomesticRoute={isDomesticRoute}
            isMobileViewport={isMobileViewport}
            isReloading={isReloading}
            mobileRoundtripTab={mobileRoundtripTab}
            onClearInbound={() => setSelectedInbound(null)}
            onClearOutbound={() => setSelectedOutbound(null)}
            onFilterInboundChange={setFilterInbound}
            onFilterOutboundChange={setFilterOutbound}
            onLoadMoreInbound={() => setInboundDisplayLimit((value) => value + FLIGHT_LOAD_MORE_STEP)}
            onLoadMoreOutbound={() => setOutboundDisplayLimit((value) => value + FLIGHT_LOAD_MORE_STEP)}
            onLoadMorePairs={() => setPairDisplayLimit((value) => value + PAIR_LOAD_MORE_STEP)}
            onMobileRoundtripTabChange={setMobileRoundtripTab}
            onPairSourceFilterChange={setPairSourceFilter}
            onRoundtripViewModeChange={setRoundtripViewMode}
            onSelectDepartDate={selectDepartDate}
            onSelectFlight={(flight, direction) => selectFlight(flight, direction)}
            onSelectPair={selectRoundtripPair}
            onSelectReturnDate={selectReturnDate}
            onContinue={() => { if (selectedOutbound && selectedInbound) goQuote(selectedOutbound, selectedInbound); }}
            selectionTotal={totalRoundtrip}
            onSortDepartChange={setSortDepart}
            onSortReturnChange={setSortReturn}
            outboundDailyMinPrice={outboundDailyMinPrice}
            outboundResults={outboundResults}
            pairAnchorFlight={pairAnchorFlight}
            pairLoadedNotice={pairLoadedNotice}
            pairLoadMoreStep={PAIR_LOAD_MORE_STEP}
            pairFilterInboundFlights={pairFilterInboundFlights}
            pairFilterOutboundFlights={pairFilterOutboundFlights}
            pairOptions={pairOptions}
            pairSourceFilter={pairSourceFilter}
            pairSources={pairSources}
            resultsGen={resultsGen}
            returnDateLabel={returnDate || toYmd(10)}
            routeMatchesResults={routeMatchesResults}
            roundtripViewMode={roundtripViewMode}
            selectedInbound={selectedInbound}
            selectedOutbound={selectedOutbound}
            selectedPairId={selectedPairId}
            sortDepart={sortDepart}
            sortReturn={sortReturn}
            sortedInbound={sortedInbound}
            sortedOutbound={sortedOutbound}
            sourceScopedPairCount={sourceScopedPairOptions.length}
            streamErrorCount={streamErrorCount}
            streamState={streamState}
            streamStatusLabel={streamStatusLabel}
            toCode={toCode}
            visibleInbound={visibleInbound}
            visibleOutbound={visibleOutbound}
            visiblePairOptions={visiblePairOptions}
          />
        )}
        </div>

        {showFloatingQuoteDock && (
          <div>
          <FloatingQuoteDock
            tripType={tripType}
            onewayFlight={selectedOneway}
            outboundFlight={selectedOutbound}
            inboundFlight={selectedInbound}
            onewayDailyMinPrice={onewayDailyMinPrice}
            outboundDailyMinPrice={outboundDailyMinPrice}
            inboundDailyMinPrice={inboundDailyMinPrice}
            total={tripType === 'oneway' ? totalOneway : totalRoundtrip}
            adults={adults}
            children={children}
            infants={infants}
            bottom={floatingQuoteDockBottom}
            dockRef={floatingQuoteDockRef}
            onClear={() => {
              setSelectedOneway(null);
              setSelectedOutbound(null);
              setSelectedInbound(null);
              setSelectedPairId('');
              setMobileRoundtripTab('outbound');
            }}
            onContinue={() => {
              if (tripType === 'oneway' && selectedOneway) {
                goQuote(selectedOneway);
                return;
              }
              if (tripType === 'roundtrip' && selectedOutbound && selectedInbound) {
                goQuote(selectedOutbound, selectedInbound);
              }
            }}
          />
          </div>
        )}

        <div
          aria-hidden="true"
          className="transition-[height] duration-300"
          style={{ height: showFloatingQuoteDock ? floatingQuoteDockHeight + 24 : 0 }}
        />

        <HomeFooter footerRef={footerRef} />
    </main>
  );
}
