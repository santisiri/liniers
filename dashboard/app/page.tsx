"use client";

import React, { useState } from "react";
import { Header, type TabId } from "@/components/Header";
import { DirectionView } from "@/components/DirectionView";
import { OverviewView } from "@/components/OverviewView";
import { AgentMapView } from "@/components/AgentMapView";
import { ConversationsView } from "@/components/ConversationsView";
import { GalleryView } from "@/components/GalleryView";
import { DecisionsView } from "@/components/DecisionsView";
import { SettingsView } from "@/components/SettingsView";
import { useData } from "@/lib/useData";
import type { StateJson } from "@/lib/types";

export default function Page() {
  const [tab, setTab] = useState<TabId>("direction");
  // Shared state fetch: used by the header badge; each view keeps its own feed.
  const { data: state } = useData<StateJson>("/api/state", 10000);
  const pendingCount = state?.decisions?.pending?.length ?? 0;

  return (
    <>
      <Header active={tab} onChange={setTab} pendingDecisions={pendingCount} />
      <main className="main">
        {tab === "direction" && <DirectionView />}
        {tab === "overview" && <OverviewView onNavigate={setTab} />}
        {tab === "map" && <AgentMapView />}
        {tab === "conversations" && <ConversationsView />}
        {tab === "gallery" && <GalleryView />}
        {tab === "decisions" && <DecisionsView />}
        {tab === "settings" && <SettingsView />}
      </main>
    </>
  );
}
