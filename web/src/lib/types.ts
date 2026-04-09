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
