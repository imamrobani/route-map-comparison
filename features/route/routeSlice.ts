import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { Coordinate, Route } from './types';

export type RouteState = {
  origin: Coordinate | null;
  destination: Coordinate | null;
  route: Route | null;
  isLoading: boolean;
  error: string | null;
};

const initialState: RouteState = {
  origin: null,
  destination: null,
  route: null,
  isLoading: false,
  error: null,
};

const routeSlice = createSlice({
  name: 'route',
  initialState,
  reducers: {
    setOrigin(state, action: PayloadAction<Coordinate | null>) {
      state.origin = action.payload;
      state.route = null;
      state.error = null;
    },
    setDestination(state, action: PayloadAction<Coordinate | null>) {
      state.destination = action.payload;
      state.route = null;
      state.error = null;
    },
    setRoute(state, action: PayloadAction<Route | null>) {
      state.route = action.payload;
      state.error = null;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    resetRouteState() {
      return initialState;
    },
  },
});

export const { setOrigin, setDestination, setRoute, setLoading, setError, resetRouteState } =
  routeSlice.actions;

export const routeReducer = routeSlice.reducer;

