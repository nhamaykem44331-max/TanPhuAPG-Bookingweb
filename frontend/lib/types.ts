export type TripType = 'oneway' | 'roundtrip';
export type Cabin = 'economy' | 'premium' | 'business' | 'first';
export type SourceMode = 'auto';
export type PassengerType = 'ADT' | 'CHD' | 'INF';

export interface AirportRecord {
  code: string;
  city: string;
  name: string;
  country: string;
  domestic: boolean;
}

export interface AirportOption extends AirportRecord {
  label: string;
  tags?: string[];
  aliases?: string[];
}

export interface AirportSelection {
  code: string;
  label: string;
}

export interface SearchPayload {
  from: string;
  to: string;
  date: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  cabin: Cabin;
  tripType: TripType;
}

export interface FlightEndpoint {
  airport: string;
  airportName: string;
  city: string;
  time: string;
}

export interface FlightResult {
  id: string;
  searchId?: string;
  fareId?: string;
  airline: string;
  airlineCode: string;
  airlineLogo?: string;
  flightNumber: string;
  departure: FlightEndpoint;
  arrival: FlightEndpoint;
  duration: number;
  stops: number;
  price: {
    amount: number;
    currency: 'VND';
    source: string;
  };
  detailUrl?: string | null;
  fareBreakdown?: {
    baseAmount: number;
    taxesFees: number;
    totalAmount: number;
    currency: 'VND';
  };
  fareOptions?: {
    id: string;
    class?: string;
    cabinClass?: string;
    fareBasis?: string;
    fareFamily?: string;
    carryOnText?: string;
    checkedBaggageText?: string;
    isBusiness?: boolean;
    seatAvailable?: number;
    totalAmount?: number;
    fareBreakdown?: {
      baseAmount: number;
      taxesFees: number;
      totalAmount: number;
      currency: 'VND';
    };
  }[];
  namthanh?: {
    flightId?: string;
    fareId?: string;
    systemName?: string;
    source?: string;
    class?: string;
    cabinClass?: string;
    fareBasis?: string;
    fareFamily?: string;
    carryOnText?: string;
    checkedBaggageText?: string;
    isBusiness?: boolean;
    seatAvailable?: number;
    route?: string;
    segments?: {
      carrierCode?: string;
      carrierName?: string;
      airlineCode?: string;
      airlineName?: string;
      flightNumber?: string;
      from?: string;
      to?: string;
      departDate?: string;
      arrivalDate?: string;
      duration?: number;
      airCraft?: string;
      logo?: string;
      logoUrl?: string;
      airlineLogo?: string;
    }[];
  };
  priceUSD: number;
  sources: string[];
}

export interface RoundtripPairOption {
  id: string;
  source: string;
  systemName?: string;
  outboundFlightId: string;
  outboundFareId?: string;
  inboundFlightId: string;
  inboundFareId?: string;
  outbound: FlightResult;
  inbound: FlightResult;
  totalAmount: number;
  currency: 'VND';
  totalUSD: number;
  airlines: string[];
  stops: number;
}

export interface SearchResponse {
  searchId: string;
  results: FlightResult[];
  departureResults?: FlightResult[];
  returnResults?: FlightResult[];
  pairOptions?: RoundtripPairOption[];
  metadata: {
    totalResults: number;
    departureCount?: number;
    returnCount?: number;
    pairCount?: number;
    displayedResultCount?: number;
    displayedDepartureCount?: number;
    displayedReturnCount?: number;
    displayedPairCount?: number;
    loadedPairCount?: number;
    journeyType?: 'OW' | 'RT';
    searchTime: number;
    cached?: boolean;
    sourceUsed?: string;
    engine?: string;
    sessionID?: number;
    expiresAt?: string;
    airlineErrors?: Record<string, string>;
  };
}

export interface HoldBookingPassenger {
  id?: string;
  type?: PassengerType;
  title?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  name?: string;
  dateOfBirth?: string;
  birthday?: string;
  loyaltyAirline?: string;
  loyaltyNumber?: string;
  goldCard?: string;
  passport?: {
    number?: string;
    nationality?: string;
    issuingCountry?: string;
    issueDate?: string;
    expiryDate?: string;
  };
  listLuggage?: {
    route: string;
    segmentId?: number;
    airline?: string;
    serviceType?: string;
    code: string;
    key: string;
    description?: string;
    unit?: string;
    price?: number;
  }[];
  ancillaryServices?: {
    route?: string;
    segmentId?: number;
    airline?: string;
    serviceType?: string;
    code: string;
    key: string;
    description?: string;
    unit?: string;
    price?: number;
  }[];
}

export interface HoldBookingRequest {
  searchId?: string;
  flightId?: string;
  fareId?: string;
  flight?: FlightResult;
  outbound?: FlightResult;
  inbound?: FlightResult;
  tripType?: TripType;
  search?: {
    from: string;
    to: string;
    date: string;
    returnDate?: string;
  };
  adults?: number;
  children?: number;
  infants?: number;
  cabin?: Cabin;
  passenger?: string | HoldBookingPassenger;
  passengers?: HoldBookingPassenger[];
  contact?: {
    phone?: string;
    email?: string;
    fullName?: string;
    address?: string;
    extraInfo?: string;
  };
  dryRun?: boolean;
  fastHold?: boolean;
  skipPricingSync?: boolean;
  idempotencyKey?: string;
}

export interface HoldBookingPnrPricing {
  pnr: string;
  totalAmount: number;
  currency?: string;
  bookingId?: number;
  bookingStatus?: string;
  timelimit?: string;
  bookingTime?: string;
}

export interface HoldBookingPricing {
  verified: boolean;
  source?: string;
  totalAmount?: number;
  currency?: string;
  byPnr?: HoldBookingPnrPricing[];
  unresolvedPnrs?: string[];
  syncedAt?: string;
  message?: string;
}

export interface HoldBookingResponse {
  success: boolean;
  bookingId?: string;
  orderCode?: string | null;
  holdId?: string;
  dryRun?: boolean;
  splitRoundtrip?: boolean;
  sessionID?: number;
  passenger?: string;
  totalAmount: number | null;
  netPrice?: string;
  markupAmount?: string;
  sellPrice?: string;
  currency?: string;
  holdExpiresAt?: string | null;
  markupRuleApplied?: {
    id: string;
    name: string;
  };
  priceDelta?: {
    before: string;
    after: string;
    percent: string;
    reason: 'AIRLINE_PRICE_CHANGE';
  };
  pricing?: HoldBookingPricing;
  protectionVerified?: boolean;
  legs?: {
    outbound?: HoldBookingResponse;
    inbound?: HoldBookingResponse;
  };
  pnrs?: {
    airline?: string;
    pnr?: string;
    status?: string;
    from?: string;
    to?: string;
    timelimit?: string;
    message?: string;
  }[];
  error?: string;
}

export interface BookingAncillaryService {
  route: string;
  segmentId: number;
  paxId: string;
  paxType: PassengerType;
  airline?: string;
  serviceType: string;
  code: string;
  description: string;
  price: number;
  currency?: string;
  unit?: string;
  key: string;
}

export interface BookingAncillaryResponse {
  success: boolean;
  warning?: string;
  message?: string;
  routes: {
    route: string;
    segmentId: number;
    airline?: string;
    services: BookingAncillaryService[];
  }[];
}

export interface QuotePayload {
  tripType: 'oneway' | 'roundtrip';
  outbound: FlightResult;
  inbound?: FlightResult;
  adults: number;
  children: number;
  infants: number;
  cabin: Cabin;
  search: {
    from: string;
    to: string;
    date: string;
    returnDate?: string;
  };
  searchExpiresAt?: string;
  createdAt: string;
  quoteCode?: string;
}
