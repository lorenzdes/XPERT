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

  const roleFor = (cid) => companies.find((c) => c.id === cid)?.role || null;
  const canWrite = (cid) => ["editor", "admin"].includes(roleFor(cid));
  const canWriteAny = companies.some((c) => ["editor", "admin"].includes(c.role));

  return (
    <CompanyContext.Provider value={{ companies, companyId, setCompanyId, roleFor, canWrite, canWriteAny, reload: load }}>
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => useContext(CompanyContext);
