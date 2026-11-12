"use client"

import { useStore } from "@/lib/store"

export function BusinessHours() {
  const { config } = useStore()

  return <span className="whitespace-pre-line">{config.hours}</span>
}
