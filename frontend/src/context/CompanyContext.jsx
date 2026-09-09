import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("all");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/companies");
      setCompanies(data);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <CompanyContext.Provider value={{ companies, companyId, setCompanyId }}>
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => useContext(CompanyContext);
