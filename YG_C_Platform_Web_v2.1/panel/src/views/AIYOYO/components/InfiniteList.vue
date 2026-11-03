<script setup lang="ts" generic="T">
import { nextTick, onBeforeUnmount, onMounted, ref, type Ref } from "vue";

type FetchResult = {
  records: T[];
  /** 全部数据条数（接口 total） */
  total: number;
};

const props = withDefaults(
  defineProps<{
    fetcher: (current: number, size: number) => Promise<FetchResult>;
    size?: number;
  }>(),
  { size: 10 }
);

const items: Ref<T[]> = ref([]);
const current = ref(0);
const loaded = ref(false);
const loading = ref(false);
const finished = ref(false);
const failed = ref(false);
const lastError = ref<unknown>(null);

const rootRef = ref<HTMLElement | null>(null);
const sentinelRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
let scrollHost: HTMLElement | Window | null = null;
let onScroll: (() => void) | null = null;

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el?.parentElement ?? null;
  while (node) {
    const style = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(style.overflowY)) return node;
    node = node.parentElement;
  }
  return null;
}

function isSentinelNear(
  sentinel: HTMLElement,
  scrollRoot: HTMLElement | null,
  threshold = 120
): boolean {
  const rect = sentinel.getBoundingClientRect();
  if (scrollRoot) {
    const rootRect = scrollRoot.getBoundingClientRect();
    return rect.top <= rootRect.bottom + threshold;
  }
  const viewH = window.innerHeight || document.documentElement.clientHeight;
  return rect.top <= viewH + threshold;
}

function onScrollNearEnd(): void {
  if (loading.value || finished.value || failed.value) return;
  const sentinel = sentinelRef.value;
  if (!sentinel) return;
  const scrollRoot = findScrollParent(rootRef.value);
  if (isSentinelNear(sentinel, scrollRoot)) void loadNext();
}

async function loadNext(): Promise<void> {
  if (loading.value || finished.value || failed.value) return;
  loading.value = true;
  const nextPage = current.value + 1;
  try {
    const res = await props.fetcher(nextPage, props.size);
    items.value = [...items.value, ...res.records];
    current.value = nextPage;
    if (items.value.length >= res.total) finished.value = true;
    failed.value = false;
    lastError.value = null;
  } catch (e) {
    console.error("[InfiniteList] fetcher failed", e);
    failed.value = true;
    lastError.value = e;
  } finally {
    loading.value = false;
    loaded.value = true;
  }

  await nextTick();
  onScrollNearEnd();
}

function refresh(): void {
  items.value = [];
  current.value = 0;
  loaded.value = false;
  finished.value = false;
  failed.value = false;
  lastError.value = null;
  void loadNext();
}

function retry(): void {
  if (!failed.value) return;
  failed.value = false;
  lastError.value = null;
  void loadNext();
}

onMounted(() => {
  const sentinel = sentinelRef.value;
  if (!sentinel) return;
  const scrollParent = findScrollParent(rootRef.value);

  if (typeof IntersectionObserver !== "undefined") {
    observer = new IntersectionObserver(
      entries => {
        if (loading.value || failed.value) return;
        if (entries.some(e => e.isIntersecting)) void loadNext();
      },
      { root: null, rootMargin: "0px 0px 120px 0px", threshold: 0 }
    );
    observer.observe(sentinel);
  }

  scrollHost = scrollParent ?? window;
  onScroll = onScrollNearEnd;
  scrollHost.addEventListener("scroll", onScroll, {
    passive: true
  } as AddEventListenerOptions);
  if (scrollParent && scrollParent !== document.documentElement) {
    window.addEventListener("scroll", onScroll, {
      passive: true
    } as AddEventListenerOptions);
  }

  void loadNext();
});

onBeforeUnmount(() => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (onScroll) {
    if (scrollHost) scrollHost.removeEventListener("scroll", onScroll);
    window.removeEventListener("scroll", onScroll);
    scrollHost = null;
    onScroll = null;
  }
});

defineExpose({ refresh, retry });

defineSlots<{
  default(props: { item: T; index: number }): unknown;
  empty(): unknown;
  loading(): unknown;
  error(props: { error: unknown; retry: () => void }): unknown;
  end(): unknown;
}>();
</script>

<template>
  <div ref="rootRef" class="infinite-list">
    <template v-if="items.length">
      <template v-for="(item, index) in items" :key="index">
        <slot :item="item as T" :index="index" />
      </template>
    </template>
    <slot v-else-if="loaded && finished" name="empty" />

    <div
      ref="sentinelRef"
      class="infinite-list__sentinel"
      aria-hidden="true"></div>

    <div v-if="loading" class="infinite-list__status">
      <slot name="loading">加载中...</slot>
    </div>
    <div
      v-else-if="failed"
      class="infinite-list__status infinite-list__status--error"
      role="button"
      tabindex="0"
      @click="retry"
      @keydown.enter.prevent="retry"
      @keydown.space.prevent="retry">
      <slot name="error" :error="lastError" :retry="retry"
        >加载失败，点击重试</slot
      >
    </div>
    <div
      v-else-if="finished && items.length"
      class="infinite-list__status infinite-list__status--end">
      <slot name="end">-到底了-</slot>
    </div>
  </div>
</template>

<style scoped lang="scss">
.infinite-list {
  width: 100%;
}

.infinite-list__sentinel {
  width: 100%;
  height: 1px;
}

.infinite-list__status {
  @apply text-center;
  padding: 0.8571rem 0;
  font-size: 0.8571rem;
  line-height: 1.35;
  color: #999999;
}

.infinite-list__status--end {
  font-size: 0.7857rem;
}

.infinite-list__status--error {
  color: #ff4d4f;
  cursor: pointer;
}
</style>
