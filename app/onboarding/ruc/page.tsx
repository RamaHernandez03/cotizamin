import { Suspense } from "react";
import RucForm from "./RucForm";

export default function Page({
  searchParams,
}: {
  searchParams?: { from?: string };
}) {
  const fromParam = typeof searchParams?.from === "string" ? searchParams!.from! : undefined;
  // Usá el que prefieras como default
  const from = fromParam && fromParam.length > 0 ? fromParam : "/dashboard/home";

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-white">
          Cargando…
        </div>
      }
    >
      <RucForm from={from} />
    </Suspense>
  );
}
