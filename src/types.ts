export interface Coordinates {
  lat: number;
  lng: number;
}

export interface OrderStatus {
  step: number;
  label: string;
  description: string;
}

export interface EtaInfo {
  minutes: number | null;
  rawText: string;
}

export interface GpsData {
  restaurant: Coordinates | null;
  destination: Coordinates | null;
  courier: Coordinates | null;
}

/** Raw snapshot extracted from the page DOM on each poll. */
export interface TrackingSnapshot {
  restaurantName: string;
  status: OrderStatus;
  eta: EtaInfo;
  gps: GpsData;
}

/** A persisted log entry written only when something changed. */
export interface TrackingEvent {
  timestamp: string;
  trackingCode: string;
  restaurantName: string;
  status: OrderStatus;
  eta: EtaInfo;
  gps: GpsData;
  destinationAddress: string | null;
  changes: string[];
}
