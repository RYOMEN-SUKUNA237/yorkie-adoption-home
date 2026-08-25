import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface RouterCtx {
  path: string;
  search: string;
  navigate: (to: string) => void;
  getParam: (key: string) => string | null;
}

const Ctx = createContext<RouterCtx>({
  path: "/",
  search: "",
  navigate: () => {},
  getParam: () => null,
});

export function RouterProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState({
    path: window.location.pathname,
    search: window.location.search,
  });

  useEffect(() => {
    const handler = () =>
      setLoc({ path: window.location.pathname, search: window.location.search });
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const navigate = useCallback((to: string) => {
    window.history.pushState(null, "", to);
    const url = new URL(to, window.location.origin);
    setLoc({ path: url.pathname, search: url.search });
    window.scrollTo(0, 0);
  }, []);

  const getParam = useCallback(
    (key: string) => new URLSearchParams(loc.search).get(key),
    [loc.search]
  );

  return (
    <Ctx.Provider value={{ path: loc.path, search: loc.search, navigate, getParam }}>
      {children}
    </Ctx.Provider>
  );
}

export const useRouter = () => useContext(Ctx);
