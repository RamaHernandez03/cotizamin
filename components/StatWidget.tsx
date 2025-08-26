type Props = {
    title: string;
    value: string | number;
    subtitle?: string; // ej: fecha
    status?: "ok" | "pending";
  };
  
  export default function StatWidget({ title, value, subtitle, status }: Props) {
    return (
      <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
        {/* Barra superior */}
        <div className="h-1 w-full bg-[#00152F]" />
  
        <div className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </p>
  
          <div className="mt-2">
            {status ? (
              <span
                className={
                  status === "ok"
                    ? "inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700"
                    : "inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700"
                }
              >
                {status === "ok" ? "COMPLETO" : "PENDIENTE"}
              </span>
            ) : (
              <span className="text-3xl font-bold text-[#00152F]">{value}</span>
            )}
          </div>
  
          {subtitle && (
            <p className="mt-2 text-xs text-slate-500">Última: {subtitle}</p>
          )}
        </div>
      </div>
    );
  }
  