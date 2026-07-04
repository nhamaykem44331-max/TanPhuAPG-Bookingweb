"use client";

import { List, useDynamicRowHeight } from 'react-window';
import type { CSSProperties } from 'react';
import FlightRow, { type AirportLabelMap } from '@/components/flight/FlightRow';
import type { FlightResult } from '@/lib/types';

const VIRTUALIZE_THRESHOLD = 18;

type VirtualizedFlightRowsProps = {
  airportLabels?: AirportLabelMap;
  btnColor?: 'gold' | 'blue';
  dailyMinPrice?: number | null;
  dense?: boolean;
  emptyClassName: string;
  emptyMessage?: string;
  flights: FlightResult[];
  maxHeightPx?: number;
  resultsGen: number;
  selectedFlightId?: string;
  showRouteColumn?: boolean;
  onDeselect?: (flight: FlightResult) => void;
  onSelect: (flight: FlightResult) => void | Promise<void>;
};

type RowProps = Omit<VirtualizedFlightRowsProps, 'emptyClassName' | 'emptyMessage' | 'maxHeightPx'>;

function renderFlightRow({
  airportLabels,
  btnColor = 'gold',
  dailyMinPrice,
  dense = false,
  flight,
  index,
  resultsGen,
  selectedFlightId,
  showRouteColumn,
  onDeselect,
  onSelect,
}: RowProps & { flight: FlightResult; index: number }) {
  const selected = selectedFlightId === flight.id;

  return (
    <div className="apg-row-in" style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
      <FlightRow
        airportLabels={airportLabels}
        btnColor={btnColor}
        dailyMinPrice={dailyMinPrice}
        dense={dense}
        f={flight}
        selected={selected}
        showRouteColumn={showRouteColumn}
        onDeselect={selected && onDeselect ? () => onDeselect(flight) : undefined}
        onSelect={() => onSelect(flight)}
      />
    </div>
  );
}

function VirtualRow({
  ariaAttributes,
  index,
  style,
  ...rowProps
}: RowProps & {
  ariaAttributes: {
    "aria-posinset": number;
    "aria-setsize": number;
    role: "listitem";
  };
  index: number;
  style: CSSProperties;
}) {
  const flight = rowProps.flights[index];
  if (!flight) return null;

  return (
    <div {...ariaAttributes} style={style}>
      {renderFlightRow({ ...rowProps, flight, index })}
    </div>
  );
}

export default function VirtualizedFlightRows({
  emptyClassName,
  emptyMessage = 'Không có chuyến phù hợp.',
  flights,
  maxHeightPx = 640,
  ...rowProps
}: VirtualizedFlightRowsProps) {
  const defaultRowHeight = rowProps.dense ? 76 : 128;
  const rowHeight = useDynamicRowHeight({
    defaultRowHeight,
    key: `${rowProps.dense ? 'dense' : 'regular'}-${flights.length}-${rowProps.selectedFlightId || ''}`,
  });

  if (flights.length === 0) {
    return <div className={emptyClassName}>{emptyMessage}</div>;
  }

  if (flights.length < VIRTUALIZE_THRESHOLD) {
    return (
      <>
        {flights.map((flight, index) => (
          <div key={`${rowProps.resultsGen}-${flight.id}`}>
            {renderFlightRow({ ...rowProps, flights, flight, index })}
          </div>
        ))}
      </>
    );
  }

  const height = Math.min(maxHeightPx, Math.max(defaultRowHeight, flights.length * defaultRowHeight));

  return (
    <List
      className="bg-white"
      defaultHeight={height}
      overscanCount={5}
      rowComponent={VirtualRow}
      rowCount={flights.length}
      rowHeight={rowHeight}
      rowProps={{ ...rowProps, flights }}
      style={{ height, width: '100%' }}
    />
  );
}
