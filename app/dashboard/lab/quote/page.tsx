// app/dashboard/lab/quote/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { notifyFromQuery } from "./actions";

export const dynamic = "force-dynamic";

const AZUL = "#00152F";
const AMARILLO = "#FFBD00";
const GRIS = "#efefef";

type SearchParams = {
  q?: string;
  marca?: string;
  modelo?: string;
  material?: string;
  limit?: string;
  sent?: string;
};

export default async function LabQuotePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // ---------- WHITELIST ----------
  // .env: TEST_LAB_ALLOWED_EMAILS="tu@mail.com, cliente@mail.com"
  const allowed = (process.env.TEST_LAB_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const userEmail = (session.user as any)?.email?.toLowerCase() ?? "";
  const isAllowed = allowed.length > 0 ? allowed.includes(userEmail) : true;
  if (!isAllowed) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div
          className="rounded-xl p-6"
          style={{ backgroundColor: GRIS, border: `1px solid ${AZUL}33` }}
        >
          <h1 className="text-xl font-semibold" style={{ color: AZUL }}>
            Acceso restringido
          </h1>
          <p className="mt-2" style={{ color: AZUL }}>
            No estás autorizado para usar este laboratorio. Agregá tu email en{" "}
            <code className="rounded bg-white px-1 py-0.5">
              TEST_LAB_ALLOWED_EMAILS
            </code>{" "}
            del archivo <code>.env</code>.
          </p>
        </div>
      </div>
    );
  }

  // ---------- BÚSQUEDA ----------
  const q = (searchParams.q || "").trim();
  const marca = (searchParams.marca || "").trim();
  const modelo = (searchParams.modelo || "").trim();
  const material = (searchParams.material || "").trim();
  const limit = Math.min(Math.max(parseInt(searchParams.limit || "10", 10) || 10, 1), 50);

  let results:
    | Array<{
        rank: number;
        proveedor_id: string;
        proveedor_nombre?: string | null;
        id_producto: string;
        codigo_interno: string | null;
        descripcion: string;
        marca: string | null;
        modelo: string | null;
        material: string | null;
        precio_actual: number;
      }>
    | null = null;

  if (q) {
    // 1) Traer coincidencias por filtros, ordenadas por precio asc
    const productos = await prisma.producto.findMany({
      where: {
        AND: [
          { precio_actual: { gt: 0 } },
          { descripcion: { contains: q, mode: "insensitive" } },
          marca ? { marca: { equals: marca, mode: "insensitive" } } : {},
          modelo ? { modelo: { equals: modelo, mode: "insensitive" } } : {},
          material ? { material: { equals: material, mode: "insensitive" } } : {},
        ],
      },
      orderBy: { precio_actual: "asc" },
      select: {
        id_producto: true,
        proveedor_id: true,
        codigo_interno: true,
        descripcion: true,
        marca: true,
        modelo: true,
        material: true,
        precio_actual: true,
      },
      take: 200, // tomamos varios y después deduplicamos por proveedor
    });

    // 2) Elegimos el más barato por proveedor (para no repetir proveedor)
    const byProveedor = new Map<string, (typeof productos)[number]>();
    for (const p of productos) {
      if (!byProveedor.has(p.proveedor_id)) {
        byProveedor.set(p.proveedor_id, p);
      }
    }
    // 3) Orden final y top N
    const uniques = Array.from(byProveedor.values()).sort(
      (a, b) => a.precio_actual - b.precio_actual
    );
    const top = uniques.slice(0, limit);

    // 4) (Opcional) Traer nombre del proveedor si existe tabla cliente
    const providerIds = top.map((t) => t.proveedor_id);
    let nombres = new Map<string, { nombre?: string | null; email?: string | null }>();
    try {
      const cli = await prisma.cliente.findMany({
        where: { id_cliente: { in: providerIds } },
        select: { id_cliente: true, nombre: true, email: true },
      });
      cli.forEach((c) => nombres.set(c.id_cliente, { nombre: c.nombre, email: (c as any).email || null }));
    } catch {
      // si no existe el modelo cliente, seguimos sin nombres
    }

    results = top.map((t, i) => ({
      rank: i + 1,
      proveedor_id: t.proveedor_id,
      proveedor_nombre: nombres.get(t.proveedor_id)?.nombre ?? null,
      id_producto: t.id_producto,
      codigo_interno: t.codigo_interno,
      descripcion: t.descripcion,
      marca: t.marca,
      modelo: t.modelo,
      material: t.material,
      precio_actual: t.precio_actual,
    }));
  }

  const sent = searchParams.sent === "1";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 md:px-8">
      <div
        className="rounded-2xl p-6 shadow-sm"
        style={{ backgroundColor: GRIS, border: `1px solid ${AZUL}1A` }}
      >
        <h1 className="text-xl font-semibold" style={{ color: AZUL }}>
          Laboratorio de Cotizaciones (Privado)
        </h1>
        <p className="mt-1 text-sm" style={{ color: `${AZUL}B3` }}>
          Buscá un producto para ver el <strong>Top 10</strong> de proveedores
          por mejor precio. Luego podés notificar esa participación a los
          proveedores para que se refleje en su pestaña <em>Feedback</em>.
        </p>

        {/* FORM BÚSQUEDA (GET) */}
        <form method="get" className="mt-6 grid gap-4 md:grid-cols-5">
          <Input name="q" label="Palabra clave (obligatorio)" defaultValue={q} required placeholder="Ej: Filtro 450mm" className="md:col-span-2" />
          <Input name="marca" label="Marca (opcional)" defaultValue={marca} />
          <Input name="modelo" label="Modelo (opcional)" defaultValue={modelo} />
          <Input name="material" label="Material (opcional)" defaultValue={material} />
          <div className="flex items-end gap-2 md:col-span-5">
            <input type="number" name="limit" min={1} max={50} defaultValue={limit} className="w-24 rounded-lg border bg-white px-3 py-2 outline-none" style={{ borderColor: "#00152F33", color: AZUL }} />
            <button
              type="submit"
              className="rounded-xl px-4 py-2 font-semibold"
              style={{ backgroundColor: AMARILLO, color: AZUL, border: `1px solid ${AZUL}26` }}
            >
              Buscar
            </button>
          </div>
        </form>

        {/* AVISO EXITO */}
        {sent && (
          <div className="mt-4 rounded-lg px-3 py-2 text-sm" style={{ background: "#dcfce7", color: "#065f46", border: "1px solid #bbf7d0" }}>
            Notificaciones creadas correctamente para los proveedores.
          </div>
        )}

        {/* RESULTADOS */}
        {results && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold" style={{ color: AZUL }}>
              Resultados ({results.length})
            </h2>

            {results.length === 0 ? (
              <div className="mt-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: `${AZUL}33`, color: `${AZUL}B3`, background: "white" }}>
                No se encontraron coincidencias con esos filtros.
              </div>
            ) : (
              <>
                <div className="mt-3 overflow-x-auto rounded-xl" style={{ border: `1px solid ${AZUL}33` }}>
                  <table className="min-w-full text-sm" style={{ color: AZUL }}>
                    <thead style={{ backgroundColor: `${AMARILLO}33` }}>
                      <tr>
                        <Th>#</Th>
                        <Th>Proveedor</Th>
                        <Th>Precio</Th>
                        <Th>Descripción</Th>
                        <Th>Marca</Th>
                        <Th>Modelo</Th>
                        <Th>Material</Th>
                        <Th>Codigo</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r) => (
                        <tr key={r.proveedor_id} style={{ borderTop: `1px solid ${AZUL}1A` }}>
                          <Td>{r.rank}</Td>
                          <Td>
                            {r.proveedor_nombre ? r.proveedor_nombre : r.proveedor_id}
                          </Td>
                          <Td>${r.precio_actual.toLocaleString("es-AR")}</Td>
                          <Td>{r.descripcion}</Td>
                          <Td>{r.marca ?? "-"}</Td>
                          <Td>{r.modelo ?? "-"}</Td>
                          <Td>{r.material ?? "-"}</Td>
                          <Td>{r.codigo_interno ?? "-"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* FORM NOTIFICAR (POST con Server Action) */}
                <form action={notifyFromQuery} className="mt-4 flex items-center gap-3">
                  {/* reenviamos los filtros a la acción para recalcular server-side */}
                  <input type="hidden" name="q" value={q} />
                  <input type="hidden" name="marca" value={marca} />
                  <input type="hidden" name="modelo" value={modelo} />
                  <input type="hidden" name="material" value={material} />
                  <input type="hidden" name="limit" value={String(limit)} />
                  <button
                    type="submit"
                    className="rounded-xl px-4 py-2 font-semibold"
                    style={{ backgroundColor: AMARILLO, color: AZUL, border: `1px solid ${AZUL}26` }}
                  >
                    Notificar proveedores (crear feedback)
                  </button>
                  <span className="text-xs" style={{ color: `${AZUL}99` }}>
                    Se crearán registros de participación para los {Math.min(results.length, limit)} proveedores listados.
                  </span>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Input({
  name,
  label,
  defaultValue,
  placeholder,
  required,
  className,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={className ?? ""}>
      <span className="mb-1 block text-sm font-medium" style={{ color: "#00152F" }}>
        {label} {required ? "*" : ""}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border bg-white px-3 py-2 outline-none"
        style={{ borderColor: "#00152F33", color: "#00152F" }}
      />
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: "#00152F" }}>
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>;
}
