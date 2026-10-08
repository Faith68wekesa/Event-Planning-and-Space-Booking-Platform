import React from 'react';
import type { FilterState, PlatformStats } from '../types';

interface HeroSearchProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  stats: PlatformStats;
  onSearch: () => void;
}

export const HeroSearch: React.FC<HeroSearchProps> = () => {
  return null;
};

export default HeroSearch;
