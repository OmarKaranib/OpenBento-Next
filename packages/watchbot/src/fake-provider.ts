import type { DiscoveredItem, SourceProvider } from "./provider";

export class FakeSourceProvider implements SourceProvider {
  readonly id = "fake";
  readonly vendor = "unspecified" as const;
  discoverCalls = 0;
  lastInput: Parameters<SourceProvider["discover"]>[0] | undefined;

  constructor(private readonly items: DiscoveredItem[] = []) {}

  setItems(items: DiscoveredItem[]): void {
    this.items.splice(0, this.items.length, ...items);
  }

  async discover(
    input: Parameters<SourceProvider["discover"]>[0],
  ): Promise<DiscoveredItem[]> {
    this.discoverCalls += 1;
    this.lastInput = input;
    return [...this.items];
  }
}
