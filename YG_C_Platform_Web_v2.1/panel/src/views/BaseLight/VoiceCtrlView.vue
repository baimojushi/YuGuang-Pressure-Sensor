<script setup lang="ts">
import { useRouter } from "vue-router";
import { xj, data, initData, status, info } from "../../stores";
import { onMounted, computed, watch, createVNode } from "vue";
import { useI18n } from 'vue-i18n';
import { theme, NavigationBar } from 'xjiang-ui';

const { t } = useI18n();
theme.setTheme("#00B988");

const router = useRouter();
const navBar = {
  title: "设置"
}

onMounted(() => {
  xj.hideNavigationBar()
})
const CourpusLen = [
  1, 2, 3, 5, 4, 2, 1
]

const VoiceControlArr = computed(() => {
  return Array.from({ length: CourpusLen.length }).map((item, index) => {
    const _i = index + 1;
    return {
      title: t(`BaseVoiceControlCorpusTitle${_i}`),
      tags: Array.from({ length: CourpusLen[index] }).map((subI, subIndex) => {
        const _subI = subIndex + 1;
        return t(`BaseVoiceControlCorpusTag${_i}_${_subI}`)
      })
    }
  });
});
// const VoiceControlArr = t("VoiceControlArr");
console.log(t("VoiceControlArr"))
</script>

<template>
  <NavigationBar :statusbar-height="(initData?.statusBarHeight || 24)" />
  <main class="main">
    <p class="text-[2rem]">{{ t("VoiceControl") }}</p>
    <div class="deviceImg">
      <img src="../../assets/images/img_top_lamp.png" />
    </div>

    <div class="card" style="padding-bottom: 1.3rem">
      <p class="vcTitle">{{ t("VoiceControlTitle") }}</p>
      <div v-if="VoiceControlArr && VoiceControlArr.length">
        <div v-for="(item, index) in VoiceControlArr" :key="index">
          <p class="vcSubTitle">{{ item.title }}</p>
          <div class="vcTags" v-if="item.tags && item.tags.length">
            <span v-for="(subItem, subIndex) in item.tags" :key="subIndex">{{ subItem }}</span>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style lang="scss" scoped>
.main {
  background: #F6F6F6;
}

.deviceImg {
  @apply pt-[3rem] pb-[4rem];

  img {
    width: 55%;
  }
}

.vcTitle {
  @apply text-[1.15rem] pb-[15px] pt-[5px];
  border-bottom: 1px solid #D8D8D8;
  font-weight: 600;
}

.vcSubTitle {
  @apply text-[.9rem] mt-[15px] text-[#8C93B0];
}

.vcTags {
  @apply flex flex-wrap flex-row;

  span {
    @apply text-[.9rem] mt-[15px] py-[8px] px-[14px] mr-[12px];
    background-color: #F7F7F7;
    border-radius: 30px;
    color: rgba(61, 61, 61, .6);
  }

}
</style>
