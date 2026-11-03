import { defineStore } from "pinia";
import { ref } from "vue";
import alarmClock from "@/assets/images/ai-clock/alarm-clock.png";
/** 当前播放的媒体信息 */
export interface MediaInfo {
  id: number;
  categoryId: number;
  icon: string;
  name: string;
  desc: string;
  durationSeconds: number;
  pid: number | string;
  did: number | string;
  status: 0 | 1;
}

export interface MediaPlayerState {
  subMethod?: string;
  resourceBundleName?: string;
  resourceId?: number | string;
  title?: string;
  description?: string;
  url?: string;
  fileSize?: number | string;
  fileSign?: string;
  totalDuration?: number | string;
  type?: string;
  audioType?: string;
  categoryId?: number | string;
  durationSeconds?: number;
  playStatus?: "playing" | "stopped" | "paused";
  pid?: number | string;
  did?: number | string;
}

export const useMediaPlayerStore = defineStore("mediaPlayer", () => {
  const curMedia = ref<MediaInfo | null>(null);

  function setMedia(media: MediaInfo | null) {
    curMedia.value = media;
  }

  function toggleStatus() {
    if (!curMedia.value) return;
    curMedia.value.status = curMedia.value.status === 1 ? 0 : 1;
  }

  function syncFromPlayerState(playerState?: MediaPlayerState | null) {
    if (!playerState?.resourceId) {
      setMedia(null);
      return;
    }

    if (playerState.playStatus === "stopped") {
      setMedia(null);
      return;
    }

    const nextStatus =
      playerState.playStatus === "playing"
        ? 1
        : playerState.playStatus === "paused"
          ? 0
          : curMedia.value?.status || 0;

    const nextMedia: MediaInfo = {
      id: Number(playerState.resourceId),
      categoryId: Number(
        playerState.categoryId || curMedia.value?.categoryId || 0
      ),
      icon: curMedia.value?.icon || alarmClock,
      name: playerState.title || curMedia.value?.name || "",
      desc: playerState.description || curMedia.value?.desc || "",
      durationSeconds:
        Number(
          playerState.totalDuration ??
            playerState.durationSeconds ??
            curMedia.value?.durationSeconds ??
            0
        ) || 0,
      pid: playerState.pid || curMedia.value?.pid || "",
      did: playerState.did || curMedia.value?.did || "",
      status: nextStatus
    };

    curMedia.value = nextMedia;
  }

  return {
    curMedia,
    setMedia,
    toggleStatus,
    syncFromPlayerState
  };
});
