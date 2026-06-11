import type { StoreApi } from 'zustand';
import type { SliceItStore } from '../types/store';

/**
 * Signature shared by every store slice: a function receiving the combined
 * store's set/get and returning its own state + actions.
 */
export type SliceCreator<T> = (
  set: StoreApi<SliceItStore>['setState'],
  get: StoreApi<SliceItStore>['getState']
) => T;
