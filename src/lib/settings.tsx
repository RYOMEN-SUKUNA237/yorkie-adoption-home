import { createContext, useContext, type ReactNode } from "react";
import { useAsync } from "../hooks/useAsync";
import { getSettings, type SettingsMap } from "../services/misc";

interface SettingsState {
  settings: SettingsMap;
  loading: boolean;
  reload: () => void;
}

const SettingsContext = createContext<SettingsState>({
  settings: {},
  loading: true,
  reload: () => {},
});

/**
 * Site settings, fetched once and shared.
 *
 * `getSettings()` already falls back to sensible defaults when Supabase is
 * absent or the query fails, so consumers never have to handle a null map.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data, loading, reload } = useAsync(() => getSettings(), []);

  return (
    <SettingsContext.Provider value={{ settings: data ?? {}, loading, reload }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
