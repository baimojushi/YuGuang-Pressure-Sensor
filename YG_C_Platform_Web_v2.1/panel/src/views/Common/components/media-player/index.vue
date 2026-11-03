<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { sendIOTEvent } from "@/utils/apis/aiClockResourceApi";
import { useMediaPlayerStore } from "../../../../stores/mediaPlayer";
import { initData, info } from "../../../../stores";

defineOptions({ name: "MediaPlayer" });

const router = useRouter();
const mediaStore = useMediaPlayerStore();
const isSubmitting = ref(false);

watch(
    () => initData.mediaPlayer,
    playerState => {
        mediaStore.syncFromPlayerState(playerState);
    },
    { deep: true, immediate: true },
);

const playWithPetByBackend = async (event: string) => {
    const media = mediaStore.curMedia;
    if (!media) return;
    // await sendResourceCustomEvent({
    //     pid: media.pid,
    //     did: media.did,
    //     event,
    // });
    await sendIOTEvent({
        topicName: `/${info.pid}/${info.did}/device/up`,
        receiveBody: {
            method: "playerReply",
            subMethod: event,
            id: 6,
            code: 0,
            params: {
                resourceId: media.id,
            }
        }
    });
};

const togglePlay = async () => {
    const media = mediaStore.curMedia;
    if (!media || isSubmitting.value) return;

    const isPlaying = media.status === 1;
    const nextEvent = isPlaying ? "pause" : "resume";

    isSubmitting.value = true;
    mediaStore.toggleStatus();

    try {
        await playWithPetByBackend(nextEvent);
    } catch (error) {
        mediaStore.toggleStatus();
        throw error;
    } finally {
        isSubmitting.value = false;
    }
};

const goDetail = () => {
    const media = mediaStore.curMedia;
    if (!media || !media.categoryId) return;
    router.push({
        path: "/resourceList/detail",
        query: { id: String(media.categoryId) },
    });
};

// mediaStore.syncFromPlayerState({
//     totalDuration: 93,
//     resourceId: "28",
//     description: "",
//     title: "捉泥鳅",
//     type: "pcm",
//     url: "`https://agent-file-manger.tos-cn-shanghai.volces.com/agent-marchant-ces674ee8f6a899788db5931e16f424b234/other/2ab304cc-7e2d-4177-b913-c124aa041e06.pcm`",
//     playStatus: "playing",
//     fileSign: "NGRiN2RkMzItNzZiYS0xMWYxLWE4MjItNTI1NGFjMTgwOTky",
//     resourceBundleName: "NurseryRhymes_Classic",
//     fileSize: "2978110"
// });
</script>

<template>
    <div v-if="mediaStore.curMedia" class="media-player">
        <div class="media-player-info" @click="goDetail">
            <img class="media-player-icon" :class="{ 'media-player-icon--paused': mediaStore.curMedia.status === 0 }"
                :src="mediaStore.curMedia.icon" :alt="mediaStore.curMedia.name" />
            <span class="media-player-title">{{ mediaStore.curMedia.name }}</span>
            <span class="media-player-desc">{{ mediaStore.curMedia.desc }}</span>
        </div>
        <div class="media-player-control" @click="togglePlay">
            <svg v-if="mediaStore.curMedia.status === 1" class="media-player-control-icon"
                xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="none" version="1.1"
                width="30" height="30" viewBox="0 0 30 30">
                <defs>
                    <clipPath id="media-player-pause-clip">
                        <rect x="0" y="0" width="30" height="30" rx="0" />
                    </clipPath>
                </defs>
                <g clip-path="url(#media-player-pause-clip)">
                    <path
                        d="M26.6569501796875,9.72001604375C26.0183311796875,8.21192074375,25.1068781796875,6.85973264375,23.9465771796875,5.69942854375C22.7862741796875,4.53912494375,21.4310831796875,3.62467374375,19.9259851796875,2.98905503375C18.3669221796875,2.32945087375,16.7089171796875,1.99365234375,14.9999421796875,1.99365234375C13.2909651796875,1.99365234375,11.6359595796875,2.32645294375,10.0738978796875,2.98905533375C8.5658025796875,3.62767244375,7.2136144796875,4.539125443750001,6.0533103796875,5.69942854375C4.8930067796875,6.85973264375,3.9785555796875,8.21491864375,3.3429368696875,9.72001604375C2.6833327096875,11.27907944375,2.3475341796875,12.93708534375,2.3475341796875,14.64606134375C2.3475341796875,16.35503534375,2.6833327096875,18.01004234375,3.3429368696875,19.57210534375C3.9815535796874997,21.08020034375,4.8930067796875,22.43239034375,6.0533103796875,23.59269534375C7.2136144796875,24.75299634375,8.5688004796875,25.66745034375,10.0738978796875,26.30306834375C11.6329612796875,26.96267534375,13.2909681796875,27.29846934375,14.9999421796875,27.29846934375C16.7089151796875,27.29846934375,18.3639221796875,26.96266934375,19.9259851796875,26.30306834375C21.4340821796875,25.66444934375,22.7862701796875,24.75299634375,23.9465771796875,23.59269534375C25.1068781796875,22.43239234375,26.0213321796875,21.07720134375,26.6569501796875,19.57210534375C27.3165571796875,18.01304034375,27.6523511796875,16.35503534375,27.6523511796875,14.64606134375C27.6523511796875,12.93708534375,27.3195491796875,11.28207874375,26.6569501796875,9.72001604375ZM14.9999421796875,25.97925734375C8.7516908796875,25.97925734375,3.6667425796875,20.89430834375,3.6667425796875,14.64606034375C3.6667425796875,8.39780904375,8.7516913796875,3.31286074375,14.9999421796875,3.31286074375C21.2481901796875,3.31286074375,26.3331391796875,8.39780954375,26.3331391796875,14.64606034375C26.3331391796875,20.89430834375,21.2481921796875,25.97925734375,14.9999421796875,25.97925734375Z"
                        fill="#D8D8D8" fill-opacity="1" />
                    <path
                        d="M12.892270085625,10.8233642578125C12.526489495625,10.8233642578125,12.232666015625,11.1171883378125,12.232666015625,11.4829695178125L12.232666015625,18.7685961578125C12.232666015625,19.134377457812498,12.526489495625,19.4281988578125,12.892270085625,19.4281988578125C13.258050715625,19.4281988578125,13.551875315625,19.1343755578125,13.551875315625,18.7685961578125L13.551875315625,11.4829695178125C13.551875315625,11.1171883378125,13.258050715625,10.8233642578125,12.892270085625,10.8233642578125ZM16.699985515625002,10.8233642578125C16.334203715625,10.8233642578125,16.040381215625,11.1171883378125,16.040381215625,11.4829695178125L16.040381215625,18.7685961578125C16.040381215625,19.134377457812498,16.334203715625,19.4281988578125,16.699985515625002,19.4281988578125C17.065765815625,19.4281988578125,17.359589615624998,19.1343755578125,17.359589615624998,18.7685961578125L17.359589615624998,11.4829695178125C17.359589615624998,11.1171883378125,17.065765815625,10.8233642578125,16.699985515625002,10.8233642578125Z"
                        fill="#191919" fill-opacity="1" />
                </g>
            </svg>
            <svg v-else class="media-player-control-icon" xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink" fill="none" version="1.1" width="30" height="30"
                viewBox="0 0 30 30">
                <defs>
                    <clipPath id="media-player-play-clip">
                        <rect x="0" y="0" width="30" height="30" rx="0" />
                    </clipPath>
                </defs>
                <g clip-path="url(#media-player-play-clip)">
                    <path
                        d="M26.6569501796875,9.72001604375C26.0183311796875,8.21192074375,25.1068781796875,6.85973264375,23.9465771796875,5.69942854375C22.7862741796875,4.53912494375,21.4310831796875,3.62467374375,19.9259851796875,2.98905503375C18.3669221796875,2.32945087375,16.7089171796875,1.99365234375,14.9999421796875,1.99365234375C13.2909651796875,1.99365234375,11.6359595796875,2.32645294375,10.0738978796875,2.98905533375C8.5658025796875,3.62767244375,7.2136144796875,4.539125443750001,6.0533103796875,5.69942854375C4.8930067796875,6.85973264375,3.9785555796875,8.21491864375,3.3429368696875,9.72001604375C2.6833327096875,11.27907944375,2.3475341796875,12.93708534375,2.3475341796875,14.64606134375C2.3475341796875,16.35503534375,2.6833327096875,18.01004234375,3.3429368696875,19.57210534375C3.9815535796874997,21.08020034375,4.8930067796875,22.43239034375,6.0533103796875,23.59269534375C7.2136144796875,24.75299634375,8.5688004796875,25.66745034375,10.0738978796875,26.30306834375C11.6329612796875,26.96267534375,13.2909681796875,27.29846934375,14.9999421796875,27.29846934375C16.7089151796875,27.29846934375,18.3639221796875,26.96266934375,19.9259851796875,26.30306834375C21.4340821796875,25.66444934375,22.7862701796875,24.75299634375,23.9465771796875,23.59269534375C25.1068781796875,22.43239234375,26.0213321796875,21.07720134375,26.6569501796875,19.57210534375C27.3165571796875,18.01304034375,27.6523511796875,16.35503534375,27.6523511796875,14.64606134375C27.6523511796875,12.93708534375,27.3195491796875,11.28207874375,26.6569501796875,9.72001604375ZM14.9999421796875,25.97925734375C8.7516908796875,25.97925734375,3.6667425796875,20.89430834375,3.6667425796875,14.64606034375C3.6667425796875,8.39780904375,8.7516913796875,3.31286074375,14.9999421796875,3.31286074375C21.2481901796875,3.31286074375,26.3331391796875,8.39780954375,26.3331391796875,14.64606034375C26.3331391796875,20.89430834375,21.2481921796875,25.97925734375,14.9999421796875,25.97925734375Z"
                        fill="#D8D8D8" fill-opacity="1" />
                    <path
                        d="M13.7806249,19.224473C13.640604,19.3174887,13.47622395,19.3670626,13.30812454,19.3669729C12.87715912,19.3849192,12.514213324,19.0480766,12.5,18.6169729L12.5,10.74197406C12.50088095665,10.58323973,12.555022836,10.4293972,12.65375018,10.30509946C12.93263018,9.972417356,13.41686368,9.90220309,13.7787497,10.14197408L19.6662483,14.079473C19.7376595,14.123432600000001,19.8010674,14.1792312,19.8537483,14.244473C20.1141953,14.576551,20.026496899999998,15.061512,19.6662483,15.2813482L13.7806249,19.224473Z"
                        fill="#191919" fill-opacity="1" />
                </g>
            </svg>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.media-player {
    position: fixed;
    bottom: 80px;
    left: 1rem;
    right: 1rem;
    z-index: 999;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.06);
    border-radius: 24px;
    background: #ffffff;
    padding: 0px 16px 0px 6px;
    width: auto;
    max-width: none;
    height: 48px;
}

.media-player-info {
    display: flex;
    flex: 1;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    padding-right: 10px;
    overflow-x: auto;
    white-space: nowrap;
}

.media-player-info::-webkit-scrollbar {
    display: none;
}

.media-player-icon {
    flex-shrink: 0;
    animation: rotate 10s linear infinite;
    border-radius: 50%;
    width: 36px;
    height: 36px;
}

.media-player-icon--paused {
    animation-play-state: paused;
}

@keyframes rotate {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

.media-player-title {
    flex-shrink: 0;
    color: #000000;
    font-size: 15px;
    line-height: 15px;
    white-space: nowrap;
}

.media-player-desc {
    flex-shrink: 0;
    color: rgba(0, 0, 0, 0.6);
    font-size: 15px;
    line-height: 15px;
    white-space: nowrap;
}

.media-player-control {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-shrink: 0;
}

.media-player-control-icon {
    width: 30px;
    height: 30px;
    color: #333333;
}
</style>