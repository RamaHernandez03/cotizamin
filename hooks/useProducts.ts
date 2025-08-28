"use client";

import useSWRInfinite from "swr/infinite";

const fetcher = async (url: string) => {
  const etagKey = url + ":etag";
  const dataKey = url;

  const etag =
    typeof window !== "undefined" ? localStorage.getItem(etagKey) : null;

  const res = await fetch(url, {
    headers: etag ? { "If-None-Match": etag } : {},
  });

  if (res.status === 304) {
    const cached =
      typeof window !== "undefined" ? localStorage.getItem(dataKey) : null;
    return cached ? JSON.parse(cached) : { items: [], nextCursor: null };
  }

  const data = await res.json();
  const newEtag = res.headers.get("etag");
  if (typeof window !== "undefined") {
    if (newEtag) localStorage.setItem(etagKey, newEtag);
    localStorage.setItem(dataKey, JSON.stringify(data));
  }
  return data;
};

export function useProducts(take = 100) {
  const getKey = (index: number, prev: any) => {
    if (index > 0 && !prev?.nextCursor) return null;
    const cursor = index === 0 ? "" : `&cursor=${prev.nextCursor}`;
    return `/api/products?take=${take}${cursor}`;
  };

  return useSWRInfinite(getKey, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
  });
}
