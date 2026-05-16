"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BoardsPanel } from "./BoardsPanel";
import { GraphPanel } from "./GraphPanel";
import { SourcesPanel } from "./SourcesPanel";
import { UnitsPanel } from "./UnitsPanel";
import { WikiPanel } from "./WikiPanel";
import type { ExtendedBrandProfile } from "./types";

export type BrandTabId = "boards" | "sources" | "wiki" | "graph" | "units";

interface BrandMemoryTabsProps {
  brand: ExtendedBrandProfile;
  activeTab: BrandTabId;
  onTabChange: (tab: BrandTabId) => void;
  onBrandChange: (brand: ExtendedBrandProfile) => void;
}

export function BrandMemoryTabs({
  brand,
  activeTab,
  onTabChange,
  onBrandChange,
}: BrandMemoryTabsProps) {
  const goToSources = (): void => onTabChange("sources");

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => onTabChange(v as BrandTabId)}
      className="flex h-full flex-col"
    >
      <div className="border-b border-border/40 px-8 py-4">
        <TabsList aria-label="Brand memory sections">
          <TabsTrigger value="boards" data-testid="brand-tab-boards">
            Boards
          </TabsTrigger>
          <TabsTrigger value="sources" data-testid="brand-tab-sources">
            Sources
          </TabsTrigger>
          <TabsTrigger value="wiki" data-testid="brand-tab-wiki">
            Wiki
          </TabsTrigger>
          <TabsTrigger value="graph" data-testid="brand-tab-graph">
            Graph
          </TabsTrigger>
          <TabsTrigger value="units" data-testid="brand-tab-units">
            Units
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <TabsContent value="boards" className="mt-0">
          <BoardsPanel brand={brand} onJumpToSources={goToSources} />
        </TabsContent>

        <TabsContent value="sources" className="mt-0">
          <SourcesPanel
            initialUrl={brand.sourceUrl}
            onScanComplete={(scanned) => {
              onBrandChange(scanned);
              onTabChange("boards");
            }}
          />
        </TabsContent>

        <TabsContent value="wiki" className="mt-0">
          <WikiPanel brand={brand} onChange={onBrandChange} />
        </TabsContent>

        <TabsContent value="graph" className="mt-0">
          <GraphPanel brand={brand} onJumpToSources={goToSources} />
        </TabsContent>

        <TabsContent value="units" className="mt-0">
          <UnitsPanel brand={brand} onChange={onBrandChange} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

export default BrandMemoryTabs;
